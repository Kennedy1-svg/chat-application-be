// routes/auth.js
const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'keyboard-cat'
const JWT_EXPIRES_IN = '7d'

// Signup
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, phone } = req.body
    if (!name || !email || !phone ) return res.status(400).json({ message: 'Missing fields' })
    const exists = await User.findOne({ email })
    if (exists) return res.status(409).json({ message: 'Email already registered' })
    const user = new User({ name, email, phone })
    await user.save()
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } })
  } catch (err) { next(err) }
})

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Missing fields' })
    const user = await User.findOne({ email })
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })
    const ok = await user.comparePassword(password)
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' })
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } })
  } catch (err) { next(err) }
})

module.exports = router
