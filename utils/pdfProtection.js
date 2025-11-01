// utils/pdfProtection.js - Utility for password protecting PDF files
const fs = require('fs').promises
const path = require('path')
const { PDFDocument } = require('pdf-lib')
const crypto = require('crypto')

class PDFProtectionService {
  constructor() {
    this.comicsDirectory = process.env.COMICS_DIRECTORY || path.join(__dirname, '../assets/comics')
    this.tempDirectory = process.env.TEMP_DIRECTORY || path.join(__dirname, '../temp')

    // Ensure temp directory exists
    this.ensureTempDirectory()
  }

  async ensureTempDirectory() {
    try {
      await fs.access(this.tempDirectory)
    } catch (error) {
      await fs.mkdir(this.tempDirectory, { recursive: true })
    }
  }

  /**
   * Generate a secure random password
   * @param {number} length - Password length (default: 12)
   * @returns {string} Generated password
   */
  generatePassword(length = 12) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()'
    let password = ''

    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }

    return password
  }

  /**
   * Get the path to the original comic PDF
   * @param {string} comicTitle - Title of the comic
   * @returns {string} Path to the comic file
   */
  getComicPath(comicTitle) {
    // Map comic titles to file names
    const comicFileMap = {
      'Mmanwu: Spirit Among Us Vol 2': 'mmanwu-vol2.pdf',
      'Alter Ego': 'alter-ego.pdf',
      'One Chance': 'one-chance.pdf',
      Homecoming: 'homecoming.pdf',
      Juwon: 'juwon.pdf',
      'Unfamiliar Soils': 'unfamiliar-soils.pdf',
      'Crime & Attraction': 'crime-and-attraction.pdf',
    }

    const fileName = comicFileMap[comicTitle]
    if (!fileName) {
      throw new Error(`Comic file not found for title: ${comicTitle}`)
    }

    return path.join(this.comicsDirectory, fileName)
  }

  /**
   * Create a password-protected PDF
   * @param {string} comicTitle - Title of the comic
   * @param {string} password - Password to protect the PDF
   * @param {string} customerEmail - Customer email for watermarking
   * @returns {Promise<Buffer>} Protected PDF buffer
   */
  async createProtectedPDF(comicTitle, password, customerEmail) {
    try {
      const originalPdfPath = this.getComicPath(comicTitle)

      // Check if original file exists
      try {
        await fs.access(originalPdfPath)
      } catch (error) {
        throw new Error(`Original PDF file not found: ${originalPdfPath}`)
      }

      // Read the original PDF
      const originalPdfBytes = await fs.readFile(originalPdfPath)
      const pdfDoc = await PDFDocument.load(originalPdfBytes)

      // Add watermark with customer email and purchase date
      await this.addWatermark(pdfDoc, customerEmail)

      // Set password protection
      pdfDoc.encrypt({
        userPassword: password,
        ownerPassword: this.generatePassword(16), // Strong owner password
        permissions: {
          printing: 'lowQuality', // Allow low quality printing
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: false,
          contentAccessibility: true,
          documentAssembly: false,
        },
      })

      // Generate the protected PDF
      const protectedPdfBytes = await pdfDoc.save()

      return Buffer.from(protectedPdfBytes)
    } catch (error) {
      console.error('Error creating protected PDF:', error)
      throw new Error(`Failed to create protected PDF: ${error.message}`)
    }
  }

  /**
   * Add watermark to PDF pages
   * @param {PDFDocument} pdfDoc - PDF document to watermark
   * @param {string} customerEmail - Customer email for watermark
   */
  async addWatermark(pdfDoc, customerEmail) {
    const pages = pdfDoc.getPages()
    const font = await pdfDoc.embedFont('Helvetica')

    const watermarkText = `Licensed to: ${customerEmail} | Purchase Date: ${new Date().toLocaleDateString()}`

    pages.forEach((page, index) => {
      const { width, height } = page.getSize()

      // Add watermark to bottom of each page
      page.drawText(watermarkText, {
        x: 20,
        y: 20,
        size: 8,
        font: font,
        color: { r: 0.7, g: 0.7, b: 0.7 }, // Light gray
        opacity: 0.6,
      })

      // Add page-specific watermark (optional - for first 3 pages)
      if (index < 3) {
        page.drawText(`© Symphonii Studios - ${customerEmail}`, {
          x: width - 200,
          y: height - 30,
          size: 6,
          font: font,
          color: { r: 0.8, g: 0.8, b: 0.8 },
          opacity: 0.4,
        })
      }
    })
  }

  /**
   * Create a temporary protected PDF file
   * @param {string} comicTitle - Title of the comic
   * @param {string} password - Password to protect the PDF
   * @param {string} customerEmail - Customer email
   * @returns {Promise<string>} Path to the temporary protected PDF
   */
  async createTempProtectedPDF(comicTitle, password, customerEmail) {
    const protectedPdfBuffer = await this.createProtectedPDF(comicTitle, password, customerEmail)

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = crypto.randomBytes(8).toString('hex')
    const fileName = `${comicTitle.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}-${randomId}.pdf`
    const tempFilePath = path.join(this.tempDirectory, fileName)

    // Write to temporary file
    await fs.writeFile(tempFilePath, protectedPdfBuffer)

    // Schedule file deletion after 1 hour
    setTimeout(
      async () => {
        try {
          await fs.unlink(tempFilePath)
          console.log(`Cleaned up temporary file: ${tempFilePath}`)
        } catch (error) {
          console.error(`Failed to delete temporary file: ${tempFilePath}`, error)
        }
      },
      60 * 60 * 1000
    ) // 1 hour

    return tempFilePath
  }

  /**
   * Validate if a comic title has an available PDF
   * @param {string} comicTitle - Title of the comic
   * @returns {Promise<boolean>} True if comic PDF exists
   */
  async validateComicExists(comicTitle) {
    try {
      const comicPath = this.getComicPath(comicTitle)
      await fs.access(comicPath)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get file size of a comic
   * @param {string} comicTitle - Title of the comic
   * @returns {Promise<number>} File size in bytes
   */
  async getComicFileSize(comicTitle) {
    try {
      const comicPath = this.getComicPath(comicTitle)
      const stats = await fs.stat(comicPath)
      return stats.size
    } catch (error) {
      return 0
    }
  }

  /**
   * Clean up old temporary files
   */
  async cleanupTempFiles() {
    try {
      const files = await fs.readdir(this.tempDirectory)
      const now = Date.now()
      const oneHourAgo = now - 60 * 60 * 1000

      for (const file of files) {
        const filePath = path.join(this.tempDirectory, file)
        const stats = await fs.stat(filePath)

        if (stats.mtime.getTime() < oneHourAgo) {
          await fs.unlink(filePath)
          console.log(`Cleaned up old temporary file: ${file}`)
        }
      }
    } catch (error) {
      console.error('Error cleaning up temporary files:', error)
    }
  }
}

// Export singleton instance
module.exports = new PDFProtectionService()

// Example usage:
/*
const pdfProtection = require('./utils/pdfProtection');

async function example() {
  try {
    // Generate password
    const password = pdfProtection.generatePassword();

    // Create protected PDF
    const protectedPdfBuffer = await pdfProtection.createProtectedPDF(
      'Alter Ego',
      password,
      'customer@example.com'
    );

    // Or create temporary file
    const tempFilePath = await pdfProtection.createTempProtectedPDF(
      'Alter Ego',
      password,
      'customer@example.com'
    );

    console.log('Protected PDF created:', tempFilePath);
  } catch (error) {
    console.error('Error:', error);
  }
}
*/
