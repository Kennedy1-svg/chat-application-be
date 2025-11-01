// Backend API implementation (Node.js/Express example)
const express = require('express')
const router = express.Router()
const nodemailer = require('nodemailer')
const { PDFDocument } = require('pdf-lib')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// Mock database for storing purchase records
const purchaseDb = []

// Configure email transporter (replace with your actual email service)
const transporter = nodemailer.createTransport({
  service: 'gmail', // or another service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

// Verify payment with Paystack
router.get('/verify-payment/:reference', async (req, res) => {
  try {
    const { reference } = req.params

    // Make API call to Paystack to verify the payment
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    })

    const paystackData = await paystackRes.json()

    if (paystackData.status && paystackData.data.status === 'success') {
      return res.json({ status: 'success', data: paystackData.data })
    } else {
      return res.status(400).json({ status: 'failed', message: 'Payment verification failed' })
    }
  } catch (error) {
    console.error('Error verifying payment:', error)
    return res.status(500).json({ status: 'error', message: 'Server error' })
  }
})

// Save purchase record
router.post('/purchases', async (req, res) => {
  try {
    const { email, title, paymentRef, purchaseType, purchaseDate } = req.body

    // In a real application, you would save this to a database
    const purchaseRecord = {
      id: crypto.randomUUID(),
      email,
      title,
      paymentRef,
      purchaseType,
      purchaseDate,
      createdAt: new Date(),
    }

    purchaseDb.push(purchaseRecord)

    return res.status(201).json({ status: 'success', data: purchaseRecord })
  } catch (error) {
    console.error('Error saving purchase:', error)
    return res.status(500).json({ status: 'error', message: 'Server error' })
  }
})

// Handle sending virtual copy
router.post('/send-virtual-copy', async (req, res) => {
  try {
    const { email, title, password, paymentRef } = req.body

    // Get the path to the PDF file (in a real app, you'd pull this from storage)
    const pdfPath = path.join(
      __dirname,
      `../comics/${title.replace(/\s+/g, '-').toLowerCase()}.pdf`
    )

    // Read the PDF file
    const pdfBytes = fs.readFileSync(pdfPath)

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes)

    // Encrypt the PDF with the password
    const encryptedPdf = await pdfDoc.save({
      password: password,
      permissions: {
        printing: 'lowResolution',
        modifying: false,
        copying: false,
        annotating: false,
        fillingForms: false,
        contentAccessibility: true,
        documentAssembly: false,
      },
    })

    // Save the encrypted PDF temporarily
    const encryptedPdfPath = path.join(__dirname, `../temp/${paymentRef}.pdf`)
    fs.writeFileSync(encryptedPdfPath, encryptedPdf)

    // Create email content
    const mailOptions = {
      from: '"Symphonii Studios" <comics@symphonii-studios.com>',
      to: email,
      subject: `Your Comic: ${title} - Symphonii Studios`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1E1E1E; padding: 20px; text-align: center;">
            <img src="https://symphonii-studios.netlify.app/logo.png" alt="Symphonii Studios Logo" style="max-width: 200px;" />
          </div>
          <div style="padding: 20px; background-color: #f5f5f5;">
            <h2 style="color: #E41E26;">Your Comic Book Purchase</h2>
            <p>Thank you for purchasing <strong>${title}</strong>!</p>
            <p>Your comic book is attached to this email as a password-protected PDF.</p>
            <p><strong>PDF Password:</strong> ${password}</p>
            <p>You'll need this password to open the comic book. Please keep it safe.</p>
            <p>Transaction Reference: ${paymentRef}</p>
            <p>If you have any issues or questions, please contact our support team at support@symphonii-studios.com</p>
          </div>
          <div style="background-color: #1E1E1E; color: white; text-align: center; padding: 15px;">
            <p>&copy; ${new Date().getFullYear()} Symphonii Studios. All rights reserved.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `${title.replace(/\s+/g, '-')}.pdf`,
          path: encryptedPdfPath,
        },
      ],
    }

    // Send email
    await transporter.sendMail(mailOptions)

    // Delete the temporary file
    fs.unlinkSync(encryptedPdfPath)

    return res.status(200).json({ status: 'success', message: 'Virtual copy sent successfully' })
  } catch (error) {
    console.error('Error sending virtual copy:', error)
    return res.status(500).json({ status: 'error', message: 'Failed to send virtual copy' })
  }
})

// Save physical order details
router.post('/physical-order', async (req, res) => {
  try {
    const { email, title, paymentRef, deliveryLocation, deliveryFee, quantity, timestamp } =
      req.body

    // In a real application, you would save this to a database
    const orderRecord = {
      id: crypto.randomUUID(),
      email,
      title,
      paymentRef,
      deliveryLocation,
      deliveryFee,
      quantity,
      timestamp,
      status: 'processing',
      createdAt: new Date(),
    }

    // Send confirmation email for physical order
    const mailOptions = {
      from: '"Symphonii Studios" <orders@symphonii-studios.com>',
      to: email,
      subject: `Order Confirmation: ${title} - Symphonii Studios`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1E1E1E; padding: 20px; text-align: center;">
            <img src="https://symphonii-studios.netlify.app/logo.png" alt="Symphonii Studios Logo" style="max-width: 200px;" />
          </div>
          <div style="padding: 20px; background-color: #f5f5f5;">
            <h2 style="color: #E41E26;">Your Physical Comic Book Order</h2>
            <p>Thank you for ordering <strong>${title}</strong>!</p>
            <p>Order Details:</p>
            <ul>
              <li>Quantity: ${quantity}</li>
              <li>Delivery Location: ${deliveryLocation}</li>
              <li>Delivery Fee: ₦${deliveryFee}</li>
              <li>Transaction Reference: ${paymentRef}</li>
            </ul>
            <p>We're processing your order and will ship it soon. You'll receive another email with tracking information once your order is shipped.</p>
            <p>If you have any questions, please contact our support team at support@symphonii-studios.com</p>
          </div>
          <div style="background-color: #1E1E1E; color: white; text-align: center; padding: 15px;">
            <p>&copy; ${new Date().getFullYear()} Symphonii Studios. All rights reserved.</p>
          </div>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)

    return res.status(201).json({ status: 'success', data: orderRecord })
  } catch (error) {
    console.error('Error processing physical order:', error)
    return res.status(500).json({ status: 'error', message: 'Server error' })
  }
})

module.exports = router
