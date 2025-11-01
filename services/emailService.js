// emailService.js - Complete email service for comic delivery
const nodemailer = require('nodemailer')
const { exec } = require('child_process')
// const PDFDocument = require('pdfkit');
const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')
const { PDFDocument: PDFLib } = require('pdf-lib') // For password protection
const bcrypt = require('bcryptjs')

class ComicEmailService {
  constructor() {
    // Configure email transporter (using Gmail as example)
    // this.transporter = nodemailer.createTransport({
    //   service: 'gmail',
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_APP_PASSWORD // Use app-specific password
    //   }
    // });

    console.log('see this', process.env.EMAIL_USER, process.env.EMAIL_APP_PASSWORD)

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // false for port 587
      requireTLS: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
      connectionTimeout: 600000,
      pool: true, // Enable connection pooling
      maxConnections: 1, // Limit concurrent connections
      maxMessages: 3, // Limit messages per connection
      rateDelta: 20000, // 20 seconds between messages
      rateLimit: 3, // Max 3 messages per rateDelta
      tls: {
        ciphers: 'SSLv3',
      },
    })
    // 'Alter Ego': './comics/alter-ego.pdf',

    // Comic file paths - adjust according to your file structure
    this.comicPaths = {
      // 'Mmanwu: Spirit Among Us Vol 2': [
      //   './comics/Mmanwu Vol 2 Chapter 1.pdf',
      //   './comics/Mmanwu Vol 2 Chapter 2.pdf',
      // ],
      'Mmanwu: Spirit Among Us Vol 2': './comics/MmanwuVol-1.pdf',
      'Alter Ego': './comics/MmanwuVol-1.pdf',
      'One Chance': './comics/MmanwuVol-1.pdf',
      Homecoming: './comics/MmanwuVol-1.pdf',
      Juwon: './comics/MmanwuVol-1.pdf',
      'Unfamiliar Soils': './comics/MmanwuVol-1.pdf',
      'Crime & Attraction': './comics/MmanwuVol-1.pdf',
    }
  }

  // Generate secure password for PDF
  generatePassword(email, title, paymentRef) {
    const baseString = `${email}-${title}-${paymentRef}-${Date.now()}`
    const hash = crypto.createHash('sha256').update(baseString).digest('hex')

    // Create a more user-friendly password from hash
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let password = ''

    for (let i = 0; i < 12; i++) {
      const index = parseInt(hash.substr(i * 2, 2), 16) % chars.length
      password += chars[index]
    }

    return password
  }

  async protectPDF(inputPath, outputPath, password) {
    console.log('Loaded PDF before try:', inputPath)
    try {
      // Check if input file exists
      await fs.access(inputPath)
      console.log('Input PDF exists:', inputPath)

      console.log('Password received for protection:', password, '| Type:', typeof password)
      console.log('Output path for protected PDF:', outputPath)

      // Build qpdf command
      const ownerPassword = password + '_owner'
      const cmd = `qpdf --encrypt "${password}" "${ownerPassword}" 256 --accessibility=y --extract=n --print=low --modify=none -- "${inputPath}" "${outputPath}"`

      console.log('Running qpdf command:', cmd)

      // Run qpdf command
      await new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            console.error('❌ qpdf error:', stderr)
            reject(new Error(stderr))
          } else {
            console.log('✅ PDF protected successfully!')
            resolve()
          }
        })
      })

      // Optional verification: check file was written
      await fs.access(outputPath)
      console.log('Verified output PDF exists:', outputPath)

      return true
    } catch (error) {
      console.error('Error protecting PDF:', error)
      return false
    }
  }

  generateEmailTemplate(customerName, comicTitle, password, paymentRef, downloadLink = '') {
    const isLink = !!downloadLink

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Comic Purchase - Symphonii Studios</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          background-color: #f4f4f4;
        }
        .container {
          background-color: #ffffff;
          margin: 20px;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #FF6B6B, #FF8E53);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: bold;
        }
        .content {
          padding: 30px;
        }
        .comic-info {
          background-color: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #FF6B6B;
          margin: 20px 0;
        }
        .password-section {
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          text-align: center;
        }
        .password {
          font-size: 24px;
          font-weight: bold;
          color: #d63384;
          background-color: #f8f9fa;
          padding: 10px 20px;
          border-radius: 5px;
          display: inline-block;
          margin: 10px 0;
          letter-spacing: 2px;
          border: 2px dashed #d63384;
        }
        .instructions {
          background-color: #e7f3ff;
          border-left: 4px solid #007bff;
          padding: 15px;
          margin: 20px 0;
        }
        .footer {
          background-color: #2c3e50;
          color: white;
          padding: 20px;
          text-align: center;
          font-size: 14px;
        }
        .button {
          display: inline-block;
          background-color: #FF6B6B;
          color: white;
          padding: 12px 25px;
          text-decoration: none;
          border-radius: 5px;
          margin: 10px 0;
          font-weight: bold;
        }
        .warning {
          color: #d63384;
          font-weight: bold;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Thank You for Your Purchase!</h1>
          <p>Your digital comic is ready</p>
        </div>
  
        <div class="content">
          <h2>Hello ${customerName}!</h2>
  
          <p>We're excited to confirm that your payment has been successfully processed. Your digital comic is now ready!</p>
  
          <div class="comic-info">
            <h3>📚 Purchase Details</h3>
            <p><strong>Comic Title:</strong> ${comicTitle}</p>
            <p><strong>Payment Reference:</strong> ${paymentRef}</p>
            <p><strong>Purchase Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Format:</strong> Digital PDF</p>
          </div>
  
          ${
            isLink
              ? `
              <div class="instructions">
                <h3>🔗 Download Your Comic</h3>
                <p>Your comic is too large to attach directly, so we've provided a secure download link below:</p>
                <p><a href="${downloadLink}" class="button" target="_blank">Download Comic</a></p>
                <p class="warning">⚠️ This link may expire. Please download your comic promptly.</p>
              </div>
              `
              : `
              <div class="password-section">
                <h3>🔐 Your Comic Access Password</h3>
                <p>Your PDF is password-protected for security. Use this password to open your comic:</p>
                <div class="password">${password}</div>
                <p class="warning">⚠️ Please save this password securely. You'll need it every time you open the comic.</p>
              </div>
  
              <div class="instructions">
                <h3>📖 How to Access Your Comic</h3>
                <ol>
                  <li>Download the attached PDF file</li>
                  <li>Open the file with any PDF reader (Adobe Reader, Preview, etc.)</li>
                  <li>When prompted, enter the password provided above</li>
                  <li>Enjoy reading your comic!</li>
                </ol>
              </div>
              `
          }
  
          <h3>💡 Tips for the Best Reading Experience</h3>
          <ul>
            <li>For best quality, view the PDF at 100% zoom or higher</li>
            <li>Use full-screen mode for an immersive reading experience</li>
            <li>The PDF works on all devices - phone, tablet, computer</li>
            <li>You can print the comic for personal use only</li>
          </ul>
  
          <h3>🎯 Need Help?</h3>
          <p>If you have any issues accessing your comic or need technical support, don't hesitate to contact us:</p>
          <ul>
            <li>Email: Symphoniistudios@gmail.com</li>
            <li>Phone: +2347039999979</li>
            <li>Website: www.symphoniistudios.com</li>
          </ul>
  
          <p>Thank you for supporting Symphonii Studios! We hope you enjoy your comic and look forward to bringing you more amazing stories.</p>
          <p>Happy Reading! 📚✨</p>
          <p><strong>The Symphonii Studios Team</strong></p>
        </div>
  
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Symphonii Studios. All rights reserved.</p>
          <p>This email contains your purchased digital content. Please do not share your password or download link with others.</p>
          <p>For bulk orders and business inquiries, visit our website or contact us directly.</p>
        </div>
      </div>
    </body>
    </html>
    `
  }

  async sendVirtualCopy({ email, title, paymentRef, customerName = '' }) {
  try {
    const password = this.generatePassword(email, title, paymentRef);
    if (!customerName) customerName = email.split('@')[0];

    const comicPaths = this.comicPaths[title];
    if (!comicPaths || (Array.isArray(comicPaths) && comicPaths.length === 0)) {
      throw new Error(`Comic file(s) not found for: ${title}`);
    }

    const attachments = [];
    const tempPaths = [];
    await fs.mkdir('./temp', { recursive: true });

    const files = Array.isArray(comicPaths) ? comicPaths : [comicPaths];

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const fileBaseName = path.basename(filePath, '.pdf').replace(/[^a-zA-Z0-9]/g, '_');
      const protectedFileName = `${fileBaseName}_${paymentRef}.pdf`;
      const protectedPath = path.join('./temp', protectedFileName);

      const protectionSuccess = await this.protectPDF(filePath, protectedPath, password);
      if (!protectionSuccess) throw new Error(`Failed to protect PDF: ${fileBaseName}`);

      tempPaths.push(protectedPath);
      attachments.push({
        filename: `${fileBaseName}.pdf`,
        path: protectedPath,
        contentType: 'application/pdf',
        cid: `comic-${fileBaseName}`,
      });
    }

    // Customer email
    const htmlContent = this.generateEmailTemplate(customerName, title, password, paymentRef);
    const mailOptions = {
      from: { name: 'Symphonii Studios', address: process.env.EMAIL_USER },
      to: email,
      subject: `🎉 Your Digital Comic: ${title} - Symphonii Studios`,
      html: htmlContent,
      attachments: attachments,
    };

    const info = await this.transporter.sendMail(mailOptions);

    // Company notification (only if customer email was accepted)
    if (info.accepted.includes(email)) {
      const companyEmail = process.env.DELIVERY_PERSON_EMAIL || 'orders@symphoniistudios.com';
      const companyVirtualCopyHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><title>Virtual Copy Sent</title></head>
      <body>
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#fff;padding:20px;border-radius:8px">
          <h2 style="color:#28a745">✅ Virtual Copy Delivered</h2>
          <p>A customer has received their digital comic. Details below:</p>
          <ul>
            <li><strong>Comic Title:</strong> ${title}</li>
            <li><strong>Customer:</strong> ${customerName}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Payment Ref:</strong> ${paymentRef}</li>
            <li><strong>Delivery Type:</strong> Virtual Copy</li>
            <li><strong>Date Sent:</strong> ${new Date().toLocaleDateString()}</li>
          </ul>
          <p><strong>Action:</strong> No further steps required.</p>
        </div>
      </body>
      </html>
      `;

      const companyMail = {
        from: { name: 'Symphonii Studios Orders', address: process.env.EMAIL_USER },
        to: companyEmail,
        subject: `✅ Virtual Copy Sent: ${title} for ${customerName}`,
        html: companyVirtualCopyHtml,
      };

      await this.transporter.sendMail(companyMail);
    }

    // Clean temp files
    await Promise.allSettled(tempPaths.map((file) => fs.unlink(file)));

    return {
      success: true,
      messageId: info.messageId,
      passwordHash: await bcrypt.hash(password, 12),
      message: `Virtual copy${files.length > 1 ? ' copies' : ''} sent successfully`,
      filesProcessed: files.length,
    };
  } catch (error) {
    return { success: false, error: error.message, message: 'Failed to send virtual copy' };
  }
}


  // Send physical order confirmation
  async sendPhysicalOrderConfirmation({
    email,
    title,
    paymentRef,
    deliveryLocation,
    customerName = '',
    quantity = 1, // Default to 1 if not provided
    deliveryCode,
    receiptCode,
  }) {
    try {
      if (!customerName) {
        customerName = email.split('@')[0]
      }

      // --- Confirmation Links ---
      const baseUrl =
        `${process.env.FRONTEND_URL}/comics/confirm-delivery` || 'https://yourapp.com/confirm'

      // const customerLink = `${baseUrl}?ref=${encodeURIComponent(paymentRef)}&code=${receiptCode}&type=customer&email=${encodeURIComponent(email)}`
      const riderLink = `${baseUrl}?ref=${encodeURIComponent(paymentRef)}&code=${deliveryCode}&type=rider&email=${encodeURIComponent(email)}`

      // --- Email to customer ---
      const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Physical Comic Order Confirmation - Symphonii Studios</title>
        <style>
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                background-color: #f4f4f4;
            }
            .container {
                background-color: #ffffff;
                margin: 20px;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 0 20px rgba(0,0,0,0.1);
            }
            .header {
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                padding: 30px;
                text-align: center;
            }
            .content {
                padding: 30px;
            }
            .order-info, .delivery-info, .security-info {
                padding: 20px;
                margin: 20px 0;
                border-radius: 8px;
            }
            .order-info {
                background-color: #f8f9fa;
                border-left: 4px solid #28a745;
            }
            .delivery-info {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
            }
            .security-info {
                background-color: #e7f5ff;
                border: 1px solid #74c0fc;
            }
            .footer {
                background-color: #2c3e50;
                color: white;
                padding: 20px;
                text-align: center;
                font-size: 14px;
            }
            a.button {
                display: inline-block;
                background: #dc3545; /* Bootstrap red */
                color: white !important;
                padding: 12px 20px;
                border-radius: 50px; /* Fully rounded */
                text-decoration: none;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📦 Order Confirmed!</h1>
                <p>Your physical comic is being prepared for delivery</p>
            </div>

            <div class="content">
                <h2>Hello ${customerName}!</h2>

                <p>Great news! Your physical comic order has been confirmed and is now being prepared for delivery.</p>

                <div class="order-info">
                    <h3>📋 Order Details</h3>
                    <p><strong>Comic Title:</strong> ${title}</p>
                    <p><strong>Order Reference:</strong> ${paymentRef}</p>
                    <p><strong>Quantity:</strong> ${quantity}</p>
                    <p><strong>Order Date:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Format:</strong> Physical Copy</p>
                </div>

                <div class="delivery-info">
                    <h3>🚚 Delivery Information</h3>
                    <p><strong>Delivery Location:</strong> ${deliveryLocation}</p>
                    <p><strong>Estimated Delivery:</strong> 3-7 business days</p>
                </div>


                <h3>📞 Contact Us</h3>
                <p>If you have any questions about your order, please contact us:</p>
                <ul>
                    <li>Email: Symphoniistudios@gmail.com</li>
                    <li>Phone: +2347039999979</li>
                </ul>

                <p>Thank you for your order!</p>
                <p><strong>The Symphonii Studios Team</strong></p>
            </div>

            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Symphonii Studios. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `

      const mailOptions = {
        from: {
          name: 'Symphonii Studios',
          address: process.env.EMAIL_USER,
        },
        to: email,
        subject: `📦 Order Confirmation: ${title} - Symphonii Studios`,
        html: htmlContent,
      }

      const info = await this.transporter.sendMail(mailOptions)

      // --- Notification to delivery person ---
      if (info.accepted.includes(email)) {
        const deliveryEmail = process.env.DELIVERY_PERSON_EMAIL || 'deliveries@symphoniistudios.com'
const riderHtmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Delivery Assignment - Symphonii Studios</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            background-color: #f4f4f4;
        }
        .container {
            background-color: #ffffff;
            margin: 20px;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #dc3545, #c82333);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .content {
            padding: 30px;
        }
        .order-info, .security-info {
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .order-info {
            background-color: #f8f9fa;
            border-left: 4px solid #dc3545;
        }
        .security-info {
            background-color: #e7f5ff;
            border: 1px solid #74c0fc;
        }
        .footer {
            background-color: #2c3e50;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 14px;
        }
        a.button {
            display: inline-block;
            background: #dc3545; /* Red button */
            color: white !important;
            padding: 12px 20px;
            border-radius: 50px; /* Rounded pill */
            text-decoration: none;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚚 New Delivery Assigned</h1>
            <p>Please prepare for delivery</p>
        </div>

        <div class="content">
            <h2>Hello Symphonii,</h2>

            <p>A new order has been assigned to you for delivery. Please review the details below:</p>

            <div class="order-info">
                <h3>📋 Order Details</h3>
                <p><strong>Comic Title:</strong> ${title}</p>
                <p><strong>Customer:</strong> ${customerName}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Delivery Location:</strong> ${deliveryLocation}</p>
                <p><strong>Payment Ref:</strong> ${paymentRef}</p>
                <p><strong>Quantity:</strong> ${quantity}</p>
                <p><strong>Order Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>

            <div class="security-info">
                <h3>🔒 Security Code for Delivery Confirmation</h3>
                <p><strong>Your Code:</strong> <span style="font-size:18px;color:#dc3545;">${deliveryCode}</span></p>
                <p>Once you’ve delivered the package, click the button below and use this code to confirm delivery:</p>
                <p><a href="${riderLink}" class="button">Confirm Delivery</a></p>
            </div>

            <h3>📞 Support</h3>
            <p>If you experience any issues during delivery, please contact us:</p>
            <ul>
                <li>Email: Symphoniistudios@gmail.com</li>
                <li>Phone: +2347039999979</li>
            </ul>

            <p><strong>Thank you for your service!</strong></p>
            <p><strong>The Symphonii Studios Team</strong></p>
        </div>

        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Symphonii Studios. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`

        const deliveryMail = {
          from: {
            name: 'Symphonii Studios Orders',
            address: process.env.EMAIL_USER,
          },
          to: deliveryEmail,
          subject: `📦 New Order: ${title} for ${customerName}`,
          html: riderHtmlContent,
        }

        await this.transporter.sendMail(deliveryMail)
      }
      console.log('✅ Physical order confirmation sent successfully:', info.messageId)

      return {
        success: true,
        messageId: info.messageId,
        message: 'Physical order confirmation sent successfully',
      }
    } catch (error) {
      console.error('Error sending physical order confirmation:', error)
      return {
        success: false,
        error: error.message,
        message: 'Failed to send physical order confirmation',
      }
    }
  }

  async sendDeliveryConfirmationToCustomer({
    email,
    title,
    paymentRef,
    deliveryLocation,
    customerName = '',
    quantity = 1, // Default to 1 if not provided
    receiptCode,
  }) {
    try {
      if (!customerName) {
        customerName = email.split('@')[0]
      }

      // --- Confirmation Links ---
      const baseUrl =
        `${process.env.FRONTEND_URL}/comics/confirm-delivery` || 'https://yourapp.com/confirm'

      const customerLink = `${baseUrl}?ref=${encodeURIComponent(paymentRef)}&code=${receiptCode}&type=customer&email=${encodeURIComponent(email)}`
      // const riderLink = `${baseUrl}?ref=${encodeURIComponent(paymentRef)}&code=${deliveryCode}&type=rider&email=${encodeURIComponent(email)}`

      // --- Email to customer ---
      const htmlContent = `
    <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delivery Confirmation - Symphonii Studios</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            background-color: #f4f4f4;
        }
        .container {
            background-color: #ffffff;
            margin: 20px;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .content {
            padding: 30px;
        }
        .order-info, .security-info {
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .order-info {
            background-color: #f8f9fa;
            border-left: 4px solid #28a745;
        }
        .security-info {
            background-color: #e7f5ff;
            border: 1px solid #74c0fc;
        }
        .footer {
            background-color: #2c3e50;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 14px;
        }
        a.button {
            display: inline-block;
            background: #28a745;
            color: white !important;
            padding: 12px 20px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Delivery Completed</h1>
            <p>Please confirm that you’ve received your order</p>
        </div>

        <div class="content">
            <h2>Hello ${customerName}!</h2>

            <p>Your physical comic has been <strong>delivered successfully</strong>.  
               To complete your order, kindly confirm that you’ve received it.</p>

            <div class="order-info">
                <h3>📋 Order Details</h3>
                <p><strong>Comic Title:</strong> ${title}</p>
                <p><strong>Order Reference:</strong> ${paymentRef}</p>
                <p><strong>Quantity:</strong> ${quantity}</p>
                <p><strong>Delivery Address:</strong> ${deliveryLocation}</p>
                <p><strong>Delivered On:</strong> ${new Date().toLocaleDateString()}</p>
            </div>

            <div class="security-info">
                <h3>🔒 Confirmation Code</h3>
                <p><strong>Your Code:</strong> <span style="font-size:18px;color:#28a745;">${receiptCode}</span></p>
                <p>Please click the button below and enter this code to confirm that you’ve received your comic:</p>
                <p><a href="${customerLink}" class="button">Confirm Delivery</a></p>
            </div>

            <h3>📞 Need Help?</h3>
            <p>If you have any issues with your delivery, please contact us:</p>
            <ul>
                <li>Email: Symphoniistudios@gmail.com</li>
                <li>Phone: +2347039999979</li>
            </ul>

            <p>Thank you for confirming your delivery!</p>
            <p><strong>The Symphonii Studios Team</strong></p>
        </div>

        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Symphonii Studios. All rights reserved.</p>
        </div>
    </div>
</body>
</html>

    `

      const mailOptions = {
        from: {
          name: 'Symphonii Studios',
          address: process.env.EMAIL_USER,
        },
        to: email,
        subject: `📦 Delivery Confirmation: ${title} - Symphonii Studios`,
        html: htmlContent,
      }

      const info = await this.transporter.sendMail(mailOptions)

      // --- Notification to delivery person ---
      
      console.log('✅ Physical order delivery confirmation sent successfully:', info.messageId)

      return {
        success: true,
        messageId: info.messageId,
        message: 'Physical order confirmation sent successfully',
      }
    } catch (error) {
      console.error('Error sending physical order confirmation:', error)
      return {
        success: false,
        error: error.message,
        message: 'Failed to send physical order confirmation',
      }
    }
  }

 async sendCustomerDeliveryConfirmed({
  email,
  title,
  paymentRef,
  deliveryLocation,
  customerName = '',
  quantity = 1,
}) {
  try {
    if (!customerName) {
      customerName = email.split('@')[0]
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Customer Delivery Confirmation - Symphonii Studios</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            margin: 20px;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #007bff, #0dcaf0);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .content {
            padding: 30px;
          }
          .order-info {
            background-color: #f8f9fa;
            border-left: 4px solid #007bff;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
          }
          .footer {
            background-color: #2c3e50;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📩 Customer Confirmed Delivery</h1>
            <p>${customerName} has confirmed receipt of their order</p>
          </div>

          <div class="content">
            <h2>Order Confirmation Received</h2>
            <p>The customer has confirmed that they received their physical comic order.</p>

            <div class="order-info">
              <h3>📋 Order Details</h3>
              <p><strong>Customer Name:</strong> ${customerName}</p>
              <p><strong>Customer Email:</strong> ${email}</p>
              <p><strong>Comic Title:</strong> ${title}</p>
              <p><strong>Order Reference:</strong> ${paymentRef}</p>
              <p><strong>Quantity:</strong> ${quantity}</p>
              <p><strong>Delivery Address:</strong> ${deliveryLocation}</p>
              <p><strong>Confirmed On:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <p>This order can now be marked as <strong>completed</strong> in your system.</p>
          </div>

          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Symphonii Studios. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const mailOptions = {
      from: {
        name: 'Symphonii Studios System',
        address: process.env.EMAIL_USER,
      },
      to: process.env.DELIVERY_PERSON_EMAIL, // 👈 notify your own team
      subject: `✅ Customer Confirmed Delivery - ${title} [${paymentRef}]`,
      html: htmlContent,
    }

    const info = await this.transporter.sendMail(mailOptions)

    console.log('📩 Notification sent to Symphonii:', info.messageId)

    return {
      success: true,
      messageId: info.messageId,
      message: 'Customer delivery confirmation sent to Symphonii',
    }
  } catch (error) {
    console.error('Error sending customer confirmation to Symphonii:', error)
    return {
      success: false,
      error: error.message,
      message: 'Failed to notify Symphonii of delivery confirmation',
    }
  }
}

  // Test email configuration
  async testEmailConfiguration() {
    try {
      const result = await this.transporter.verify()
      console.log('✅ Email configuration successful')
      return result
    } catch (error) {
      console.error('❌ Email configuration failed:', error.message)
      throw error
    }
  }
}

module.exports = ComicEmailService
