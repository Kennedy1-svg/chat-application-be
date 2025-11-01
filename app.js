// app.js
require('dotenv').config()
const path = require('path')
const express = require('express')
const http = require('http')
const mongoose = require('mongoose')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
const { setupSocket } = require('./server/socket') // socket handlers

const authRoutes = require('./routes/auth')
const chatRoutes = require('./routes/chat')
const messageRoutes = require('./routes/message')
const userRoutes = require('./routes/user')

const app = express()
const NODE_ENV = process.env.NODE_ENV || 'development'
const PORT = process.env.PORT || 4000

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false // disable CSP here if you have dynamic scripts; enable and configure for production
  })
)

// CORS (allow frontend origins)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
  process.env.FRONTEND_PROD_URL
].filter(Boolean)

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true)

    // Check for exact match
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`Not allowed by CORS: ${origin}`))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}

app.use(cors(corsOptions))
// Body parsing (JSON) - keep for API
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: NODE_ENV === 'production' ? 100 : 1000,
})
app.use('/api/', limiter)

// Compression only in production
if (NODE_ENV === 'production') app.use(compression())

app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'))

// Static
app.use('/static', express.static(path.join(__dirname, 'public')))

// --- Mongoose connect ---
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app'
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
mongoose.connection.on('connected', () => console.log('MongoDB connected'))
mongoose.connection.on('error', (err) => console.error('MongoDB error', err))

// --- Basic routes ---
app.get('/health', (req, res) => {
  res.json({ status: 'OK', env: NODE_ENV, uptime: process.uptime() })
})
app.get('/', (req, res) => res.json({ message: 'Chat server running' }))

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/chats', chatRoutes)
app.use('/api/messages', messageRoutes)

// 404
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', path: req.originalUrl })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err)
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: err.message })
  }
  res.status(err.status || 500).json({
    success: false,
    message: NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(NODE_ENV !== 'production' && { stack: err.stack }),
  })
})

// Create HTTP server and setup Socket.IO
const server = http.createServer(app)
setupSocket(server) // attaches Socket.IO and handlers

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} in ${NODE_ENV} mode`)
})
