// routes/message.js
const express = require('express')
const Message = require('../models/Message')
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

// Get messages for chat with pagination
router.get('/:chatId', auth, async (req, res, next) => {
  try {
    const { chatId } = req.params
    const { page = 1, limit = 50 } = req.query
    const skip = (page - 1) * limit
    const messages = await Message.find({ chat: chatId })
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .populate('sender', 'name email')
    res.json(messages.reverse()) // return chronological
  } catch (err) { next(err) }
})

router.get('/:otherUserId', auth, async (req, res, next) => {
  try {

    // Assume 'req.user.id' is the current user and 'req.params.otherUserId' is the person they chatted with
const userId = req.user.id; 
const otherUserId = req.params.otherUserId;

// Find the *single* chat that includes both users.
// $all ensures that both IDs are present in the 'participants' array, regardless of order.
const chat = await Chat.findOne({
    participants: { $all: [userId, otherUserId] } 
})
.populate({
    path: 'messages', // Populate the array of message IDs
    // Optionally populate the sender for each message to show who sent it
    populate: { path: 'sender', select: 'name' } 
})
.exec();

if (!chat) {
    return res.status(404).json({ message: 'Chat not found' });
}

// Send back the array of messages
res.status(200).json(chat.messages);
    
  } catch (err) { next(err) }
})

module.exports = router
