// routes/user.js
const express = require('express')
const User = require('../models/User')
const jwt = require('jsonwebtoken')
const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'keyboard-cat'

function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header) return res.status(401).json({ message: 'No auth header' })
  const token = header.split(' ')[1]
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

router.get('/me', auth, async (req, res, next) => {
  const user = await User.findById(req.user.id).select('-password')
  res.json(user)
})



router.get('/all-users', auth, async (req, res, next) => {
  try {
    const search = req.query.search || ''

    // Search filter: matches name or email (case-insensitive)
    const searchFilter = {
      $or: [
        // { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }

    // Exclude current logged-in user
    const users = await User.find({
      _id: { $ne: req.user.id },
      ...(search ? searchFilter : {})
    }).select('-password')

    res.json(users)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    res.json(user)
  } catch (err) {
    next(err)
  }
})



module.exports = router
