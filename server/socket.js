// server/socket.js
const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
const Message = require('../models/Message')
const Chat = require('../models/Chat')
const User = require('../models/User')

const JWT_SECRET = process.env.JWT_SECRET || 'keyboard-cat'

function verifySocketToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (err) {
    return null
  }
}

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
  })

  io.use((socket, next) => {
    // Expect token in query: socket.io-client: io(URL, { query: { token }})
    const token = socket.handshake.auth?.token || socket.handshake.query?.token
    if (!token) return next(new Error('Authentication error: token required'))
    const payload = verifySocketToken(token)
    if (!payload) return next(new Error('Authentication error: invalid token'))
    socket.user = { id: payload.id, email: payload.email }
    next()
  })

  let onlineUsers = new Map()

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`)

    socket.on('user-online', async (userId) => {
    if (!userId) return;

    onlineUsers.set(userId, socket.id);

    // Get user details from DB
    const onlineUserIds = Array.from(onlineUsers.keys());
    const users = await User.find({ _id: { $in: onlineUserIds } }).select('-password');

    io.emit('online-users', users); 
  });

  socket.on('disconnect', async () => {
    // Remove disconnected user
    for (let [userId, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }

    // Send updated list
    const onlineUserIds = Array.from(onlineUsers.keys());
    const users = await User.find({ _id: { $in: onlineUserIds } }).select('-password');

    io.emit('online-users', users);
  });

    // Listen for when a user joins a two-person chat
    socket.on('join-chat', async ({ userId, recipientId }) => {
      try {
        if (!userId || !recipientId) return

        // Create a deterministic room ID (so both users end up in same room)
        const roomId = [userId, recipientId].sort().join('_')

        socket.join(roomId)
        socket.roomId = roomId // store for easy access

        console.log(`✅ Socket ${socket.id} joined room ${roomId}`)
      } catch (err) {
        console.error('join-chat error:', err)
      }
    })

    // Handle sending a message
    socket.on('send-message', async ({ senderId, recipientId, content, type = 'text' }, ack) => {
      try {
        if (!senderId || !recipientId || !content)
          return ack && ack({ success: false, message: 'senderId, recipientId, and content required' })

        // Determine roomId
        const roomId = [senderId, recipientId].sort().join('_')
        console.log('this is from the frontend', roomId)


        // Find or create chat between these two users
        let chat = await Chat.findOne({ participants: { $all: [senderId, recipientId], $size: 2 } })
        if (!chat) {
          chat = await Chat.create({ participants: [senderId, recipientId] })
        }

        // Save message
        const message = await Message.create({
          chat: chat._id,
          sender: senderId,
          content,
          type,
        })

        // Update chat metadata
        chat.lastMessage = content
        chat.updatedAt = new Date()
        chat.messages.push(message._id)
        await chat.save()

        // Emit to both users (room)
        io.to(roomId).emit('new-message', {
          _id: message._id,
          chat: chat._id,
          sender: senderId,
          recipient: recipientId,
          content,
          type,
          createdAt: message.createdAt,
        })

        ack && ack({ success: true, message: 'Message sent' })
      } catch (err) {
        console.error('send-message error:', err)
        ack && ack({ success: false, message: err.message })
      }
    })

    // Typing indicator
    socket.on('typing', ({ recipientId, senderId, isTyping }) => {
      const roomId = [senderId, recipientId].sort().join('_')
      socket.to(roomId).emit('typing', { senderId, isTyping })
    })

    // Leave chat (optional)
    socket.on('leave-chat', ({ userId, recipientId }) => {
      const roomId = [userId, recipientId].sort().join('_')
      socket.leave(roomId)
      console.log(`👋 Socket ${socket.id} left room ${roomId}`)
    })

    // On disconnect
    socket.on('disconnect', (reason) => {
      console.log(`❌ Socket disconnected ${socket.id}: ${reason}`)
    })
  })
}

module.exports = { setupSocket }
