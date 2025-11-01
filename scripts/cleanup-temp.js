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
