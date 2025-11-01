const crypto = require('crypto')

const SHARED_SECRET = process.env.SHARED_SECRET || 'super_secret_key'

// Utility: recreate HMAC signature
function generateSignature(secret, timestamp, body) {
  return crypto
    .createHmac('sha256', secret)
    .update(timestamp + body)
    .digest('hex')
}

function verifySignature(req, res, next) {
  const timestamp = req.headers['x-timestamp']
  const signature = req.headers['x-signature']
  console.log('signature from frontend', signature)
  if (!timestamp || !signature) {
    return res.status(401).json({ message: 'Missing signature or timestamp' })
  }

  // Ensure timestamp is within 2 minutes
  const now = Date.now()
  console.log(`now ${now}, timestamp ${Number(timestamp)}`)
  console.log('absolute figure', Math.abs(now - Number(timestamp)))
  if (Math.abs(now - Number(timestamp)) > 2 * 60 * 1000) {
    return res
      .status(403)
      .json({
        message: 'Request timestamp expired',
        timestampClient: Number(timestamp),
        timestampServer: now,
      })
  }

  const rawBody = JSON.stringify(req.body)
  console.log('the body coming in', rawBody)
  const expectedSignature = generateSignature(SHARED_SECRET, timestamp, rawBody)

  console.log('expected signature', expectedSignature)
  if (expectedSignature !== signature) {
    return res.status(403).json({ message: 'Invalid signature' })
  }

  // ✅ Signature verified
  next()
}

module.exports = {
  verifySignature,
}
