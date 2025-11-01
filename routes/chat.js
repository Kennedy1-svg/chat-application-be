// routes/chat.js
const express = require('express')
const Chat = require('../models/Chat')
const User = require('../models/User')
const Message = require('../models/Message')
const jwt = require('jsonwebtoken')
const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'keyboard-cat'

// simple middleware
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

// Get user's chats
router.get('/', auth, async (req, res, next) => {
  try {
    const chats = await Chat.find({ participants: req.user.id })
      .sort('-updatedAt')
      .populate('participants', 'name email')
      .populate({ path: 'messages', options: { limit: 1, sort: { createdAt: -1 } }})
    res.json(chats)
  } catch (err) { next(err) }
})

// Assuming 'router' is an Express.Router instance and 'Chat' model is imported.

router.get('/chatlist', auth, async (req, res, next) => {
    try {
        const userId = req.user.id; 

        // 1. Query all chats the user is a participant in, sort by most recent activity
        const chats = await Chat.find({ participants: userId })
            .sort('-updatedAt')
            
            // 2. Populate the other user's info (name, email)
            .populate('participants', 'name email') 
            
            // 3. Populate the messages, but only grab the single last message
            .populate({ 
                path: 'messages', 
                options: { limit: 1, sort: { createdAt: -1 } },
                // Optionally populate the sender of the last message
                populate: { path: 'sender', select: 'name' }
            })
            .exec();

        // 4. Transform the result for the client
        const chatList = chats.map(chat => {
            // Find the *other* participant in the chat
            const otherUser = chat.participants.find(p => p._id.toString() !== userId.toString());
            
            // Get the last message (it will be an array of length 0 or 1)
            const lastMessage = chat.messages.length > 0 ? chat.messages[0] : null;

            return {
                chatId: chat._id,
                // The contact is the other user in the chat
                contact: { 
                    _id: otherUser ? otherUser._id : null, 
                    name: otherUser ? otherUser.name : 'Unknown User',
                    email: otherUser ? otherUser.email : 'N/A',
                },
                // The last message for display
                lastMessage: lastMessage ? {
                    content: lastMessage.content,
                    createdAt: lastMessage.createdAt,
                    senderName: lastMessage.sender.name, // Access sender's populated name
                } : null,
                updatedAt: chat.updatedAt // For showing when the chat was last active
            };
        });

        res.status(200).json(chatList);

    } catch (err) { 
        next(err); 
    }
});

router.get('/history/:otherUserId', auth, async (req, res, next) => {
  try {
    const { otherUserId } = req.params
    console.log('this is us', otherUserId)

    // Find the one-on-one chat between both users
    let chat = await Chat.findOne({
      participants: { $all: [req.user.id, otherUserId] },
    })

    console.log('this is us', otherUserId, req.user.id, chat)


    // If no chat found, return empty history
    if (!chat) {
      return res.json({ chat: null, messages: [] })
    }

    // Get and sort messages
    const messages = await Message.find({ chat: chat._id })
      .populate('sender', 'name email')
      .sort({ createdAt: 1 })

    // Transform messages to include 'isMine'
    const formattedMessages = messages.map(msg => ({
      _id: msg._id,
      chat: msg.chat,
      sender: msg.sender,
      content: msg.content,
      createdAt: msg.createdAt,
      isMine: msg.sender._id.toString() === req.user.id.toString()
    }))

    res.json({
      chat,
      messages: formattedMessages
    })
  } catch (err) {
    next(err)
  }
})

// Create one-to-one chat (if exists return)
router.post('/private', auth, async (req, res, next) => {
  try {
    const { otherUserId } = req.body
    if (!otherUserId) {
      return res.status(400).json({ message: 'otherUserId required' })
    }

    // Prevent chatting with self
    if (otherUserId === req.user.id) {
      return res.status(400).json({ message: 'Cannot create chat with yourself' })
    }

    // Check if a private chat already exists between the two users
    let chat = await Chat.findOne({
      isGroup: false,
      participants: { $all: [req.user.id, otherUserId], $size: 2 },
    }).populate('participants', 'name email')

    if (chat) {
      return res.json(chat)
    }

    // Create a new private chat
    chat = new Chat({
      participants: [req.user.id, otherUserId],
      isGroup: false,
    })

    await chat.save()
    await chat.populate('participants', 'name email')

    res.status(201).json(chat)
  } catch (err) {
    next(err)
  }
})


module.exports = router
