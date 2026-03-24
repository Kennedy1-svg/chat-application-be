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

// Aggregate results into a report
const report = `
# Automated Code Quality Report

## Linting Results
${eslintReport.includes('error') ? 'Errors found:\n' + eslintReport : 'No linting errors found.'}

## Dependency Security Report
${auditReport}

## Code Complexity Report
${runPlato()}

## Static Analysis Report
${runSemgrep()}
`

console.log('\n--- Final Report ---')
console.log(report)

async function generateOpenAIReportAndComment(reportContent) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.log('⚠️ OPENAI_API_KEY is not set. Skipping OpenAI report generation.')
    return
  }

  console.log('🤖 Sending report to OpenAI for translation...')
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert code reviewer. You will be given an automated code quality report containing linting, dependency, complexity, and static analysis results. Your task is to translate this into a human-readable, professional, and concise PR review comment in Markdown format. Highlight critical issues, give brief actionable feedback, and provide an overall assessment.',
          },
          {
            role: 'user',
            content: reportContent,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const aiReport = data.choices[0].message.content

    // Save report to file
    fs.writeFileSync('pr-review-report.md', aiReport)
    console.log('✅ OpenAI report generated and saved to pr-review-report.md!')

    // Post comment to PR
    await postCommentToPR(aiReport)
  } catch (error) {
    console.error('❌ Failed to generate OpenAI report:', error.message)
  }
}

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

// Run the async functions and conclude the process
generateOpenAIReportAndComment(report).then(() => {
  console.log('\n🧹 Cleaning up report files...')
  if (fs.existsSync('semgrep-report.json')) {
    fs.rmSync('semgrep-report.json', { force: true })
  }
  if (fs.existsSync('plato-report')) {
    fs.rmSync('plato-report', { recursive: true, force: true })
  }
  console.log('\n✅ Review process completed!')
})
