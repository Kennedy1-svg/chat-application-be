// models/Message.js
const mongoose = require('mongoose')

const MessageSchema = new mongoose.Schema({
  chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: String,
  type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
}, { timestamps: true })

module.exports = mongoose.model('Message', MessageSchema)
