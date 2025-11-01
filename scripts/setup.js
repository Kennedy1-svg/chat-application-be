// scripts/setup.js - Initial setup script
const fs = require('fs').promises
const path = require('path')

async function setupProject() {
  console.log('🔧 Setting up Symphonii Comics Backend...\n')

  // Create necessary directories
  const directories = ['assets/comics', 'temp', 'logs', 'uploads', 'public']

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true })
      console.log(`✅ Created directory: ${dir}`)
    } catch (error) {
      console.error(`❌ Error creating directory ${dir}:`, error.message)
    }
  }

  // Create .env file if it doesn't exist
  const envPath = path.join(process.cwd(), '.env')
  try {
    await fs.access(envPath)
    console.log('✅ .env file already exists')
  } catch (error) {
    const envTemplate = `# Email Configuration
EMAIL_USER=your-gmail@gmail.com
EMAIL_APP_PASSWORD=your-app-specific-password

# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/symphonii-comics

# File Paths
COMICS_DIRECTORY=./assets/comics
TEMP_DIRECTORY=./temp

# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Security
JWT_SECRET=your-jwt-secret-here
`

    await fs.writeFile(envPath, envTemplate)
    console.log('✅ Created .env template file')
  }

  // Create .gitignore if it doesn't exist
  const gitignorePath = path.join(process.cwd(), '.gitignore')
  try {
    await fs.access(gitignorePath)
    console.log('✅ .gitignore file already exists')
  } catch (error) {
    const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log

# Temporary files
temp/
tmp/

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo

# Test coverage
coverage/

# Production build
dist/
build/

# Comics (add your actual comic files manually)
assets/comics/*.pdf

# Uploads
uploads/

# PM2
ecosystem.config.js
`

    await fs.writeFile(gitignorePath, gitignoreContent)
    console.log('✅ Created .gitignore file')
  }

  console.log('\n🎉 Setup complete!')
  console.log('\n📝 Next steps:')
  console.log('1. Update the .env file with your actual credentials')
  console.log('2. Add your comic PDF files to assets/comics/')
  console.log('3. Install dependencies: npm install')
  console.log('4. Start development server: npm run dev')
}

// scripts/cleanup-temp.js - Cleanup temporary files
async function cleanupTempFiles() {
  const tempDir = process.env.TEMP_DIRECTORY || './temp'

  try {
    const files = await fs.readdir(tempDir)
    let deletedCount = 0

    for (const file of files) {
      const filePath = path.join(tempDir, file)
      const stats = await fs.stat(filePath)
      const now = Date.now()
      const fileAge = now - stats.mtime.getTime()
      const oneHour = 60 * 60 * 1000

      if (fileAge > oneHour) {
        await fs.unlink(filePath)
        deletedCount++
        console.log(`🗑️  Deleted old temp file: ${file}`)
      }
    }

    console.log(`✅ Cleanup complete. Deleted ${deletedCount} old files.`)
  } catch (error) {
    console.error('❌ Cleanup error:', error.message)
  }
}

// Run appropriate script based on command line argument
const script = process.argv[2]

if (script === 'setup') {
  setupProject()
} else if (script === 'cleanup') {
  cleanupTempFiles()
} else {
  console.log('Available scripts:')
  console.log('- npm run setup (or node scripts/setup.js setup)')
  console.log('- npm run cleanup (or node scripts/cleanup-temp.js)')
}

module.exports = { setupProject, cleanupTempFiles }
