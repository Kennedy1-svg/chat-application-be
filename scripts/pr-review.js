import { execSync } from 'child_process'
import fs from 'fs'

function runCommand(command, options = {}) {
  try {
    const output = execSync(command, options)
    return output ? output.toString() : ''
  } catch (error) {
    // When stdio: 'inherit' is used, error.stdout/stderr may be null
    const stdout = error.stdout ? error.stdout.toString() : ''
    const stderr = error.stderr ? error.stderr.toString() : ''
    return stdout || stderr || error.message
  }
}

// Run ESLint and npm audit, for linting and dependency security checks
console.log('🔍 Starting Code Quality Review...')

console.log('Step 1/4: Running ESLint...')
const eslintReport = runCommand('npx eslint')

console.log('Step 2/4: Running npm audit...')
const auditReport = runCommand('npm audit --json')

// Static analysis with Semgrep using Docker
function runSemgrep() {
  console.log('Step 4/4: Running Semgrep (this may take a while)...')
  runCommand(
    `docker run --rm -v "${process.cwd()}:/src" returntocorp/semgrep semgrep --config=auto /src --json > semgrep-report.json`,
    { stdio: 'inherit' }
  )

  let semgrepReport = 'No semgrep report generated.'
  if (fs.existsSync('semgrep-report.json')) {
    try {
      const rawData = fs.readFileSync('semgrep-report.json', 'utf-8')
      semgrepReport = rawData
    } catch (err) {
      semgrepReport = 'Error parsing semgrep-report.json'
    }
  }
  return semgrepReport
}

// Run Plato for code complexity analysis
function runPlato() {
  console.log('Step 3/4: Running Plato Complexity Analysis...')
  runCommand('npx plato -r -d plato-report ./*.js', { stdio: 'inherit' })

  let platoReport = 'No Plato report generated.'
  const platoReportFile = 'plato-report/report.json'
  if (fs.existsSync(platoReportFile)) {
    try {
      const rawData = fs.readFileSync(platoReportFile, 'utf-8')
      platoReport = rawData
    } catch (err) {
      platoReport = 'Error checking Plato report.'
    }
  }
  return platoReport
}

// Build Markdown report natively via JS Rule Engine
function buildMarkdownReport(eslintOutput, auditOutput, semgrepOutput, platoOutput) {
  let md = '# 🤖 Automated Code Quality Report\n\n'

  // ESLint
  md += '## 🔍 Linting (ESLint)\n'
  if (!eslintOutput || !eslintOutput.includes('error')) {
    md += '✅ No linting errors found.\n\n'
  } else {
    // Truncate to avoid extremely long PR comments
    md += `⚠️ **Linting errors found:**\n\`\`\`text\n${eslintOutput.substring(0, 1000)}${eslintOutput.length > 1000 ? '\n... (truncated)' : ''}\n\`\`\`\n\n`
  }

  // npm audit
  md += '## 🛡️ Dependency Security (npm audit)\n'
  try {
    const auditData = JSON.parse(auditOutput)
    const v = auditData.metadata?.vulnerabilities
    if (v && v.total > 0) {
      md += `⚠️ **Found ${v.total} vulnerabilities**:\n- Critical: ${v.critical}\n- High: ${v.high}\n- Moderate: ${v.moderate}\n- Low: ${v.low}\n\n`
    } else {
      md += '✅ No vulnerabilities found.\n\n'
    }
  } catch (e) {
    md += '⚠️ Could not parse npm audit JSON output.\n\n'
  }

  // Plato
  md += '## 📊 Code Complexity (Plato)\n'
  if (platoOutput.startsWith('Error') || platoOutput === 'No Plato report generated.') {
    md += `⚠️ ${platoOutput}\n\n`
  } else {
    try {
      const platoData = JSON.parse(platoOutput)
      if (platoData.summary && platoData.summary.average && Array.isArray(platoData.reports) && platoData.reports.length > 0) {
        const avgMaintainability = parseFloat(platoData.summary.average.maintainability).toFixed(2)
        md += `Average Maintainability Index: **${avgMaintainability}**\n\n`
        md += `| File | Maintainability | Cyclomatic Complexity | Logical SLOC | JSHint Errors |\n`
        md += `| ---- | --------------- | --------------------- | ------------ | ------------- |\n`
        
        // Sort reports by maintainability (lowest first) to highlight problematic files
        const sortedReports = platoData.reports.sort((a, b) => {
          const aMaint = a.complexity && a.complexity.maintainability ? a.complexity.maintainability : 100;
          const bMaint = b.complexity && b.complexity.maintainability ? b.complexity.maintainability : 100;
          return aMaint - bMaint;
        });

        sortedReports.forEach(report => {
          const file = report.info && report.info.fileShort ? report.info.fileShort : 'Unknown';
          const maint = (report.complexity && report.complexity.maintainability ? report.complexity.maintainability : 0).toFixed(2);
          const complex = report.complexity && report.complexity.methodAggregate && report.complexity.methodAggregate.cyclomatic ? report.complexity.methodAggregate.cyclomatic : 0;
          const sloc = report.complexity && report.complexity.methodAggregate && report.complexity.methodAggregate.sloc && report.complexity.methodAggregate.sloc.logical ? report.complexity.methodAggregate.sloc.logical : 0;
          const jshint = report.jshint && report.jshint.messages ? report.jshint.messages : 0;
          
          md += `| \`${file}\` | ${maint} | ${complex} | ${sloc} | ${jshint} |\n`
        });
        md += '\n'
      } else {
        md += '✅ Plato run completed.\n\n'
      }
    } catch (e) {
      md += '⚠️ Could not parse Plato JSON output.\n\n'
    }
  }

  // Semgrep
  md += '## 🔐 Static Analysis (Semgrep)\n'
  if (semgrepOutput.startsWith('Error') || semgrepOutput === 'No semgrep report generated.') {
    md += `⚠️ ${semgrepOutput}\n\n`
  } else {
    try {
      const semgrepData = JSON.parse(semgrepOutput)
      const results = semgrepData.results || []
      if (results.length > 0) {
        md += `⚠️ **Found ${results.length} issues**:\n`
        results.forEach((r) => {
          md += `- **${r.check_id}** in \`${r.path}:${r.start.line}\`\n`
        })
        // if (results.length > 10) md += `- ... and ${results.length - 10} more.\n`
        md += '\n'
      } else {
        md += '✅ No static analysis issues found.\n\n'
      }
    } catch (e) {
      md += '⚠️ Could not parse Semgrep JSON output.\n\n'
    }
  }

  return md
}

const finalReportMarkdown = buildMarkdownReport(eslintReport, auditReport, runSemgrep(), runPlato())

console.log('\n--- Final Report ---')
console.log(finalReportMarkdown)

// Save report to file
fs.writeFileSync('pr-review-report.md', finalReportMarkdown)
console.log('✅ Markdown report generated and saved to pr-review-report.md!')

async function postCommentToPR(commentBody) {
  const token = process.env.GITHUB_TOKEN
  const eventPath = process.env.GITHUB_EVENT_PATH

  if (!token || !eventPath) {
    console.log('⚠️ GITHUB_TOKEN or GITHUB_EVENT_PATH not set. Skipping PR comment.')
    return
  }

  try {
    const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf8'))
    const prNumber = eventData.pull_request?.number
    const repoFullName = eventData.repository?.full_name

    if (!prNumber || !repoFullName) {
      console.log('⚠️ Could not find pull request info in GitHub event payload. Skipping comment.')
      return
    }

    console.log(`💬 Posting comment to PR #${prNumber} in ${repoFullName}...`)

    const response = await fetch(
      `https://api.github.com/repos/${repoFullName}/issues/${prNumber}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: commentBody }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GitHub API error: ${response.status} - ${errorText}`)
    }

    console.log('✅ PR comment posted successfully!')
  } catch (error) {
    console.error('❌ Failed to post PR comment:', error.message)
  }
}

postCommentToPR(finalReportMarkdown).then(() => {
  console.log('\n🧹 Cleaning up report files...')
  if (fs.existsSync('semgrep-report.json')) {
    fs.rmSync('semgrep-report.json', { force: true })
  }
  if (fs.existsSync('plato-report')) {
    fs.rmSync('plato-report', { recursive: true, force: true })
  }
  console.log('\n✅ Review process completed!')
})
