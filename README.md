# 💬 Chat App Backend

This is the backend API for the **Chat App**, built with **Node.js**, **Express**, **MongoDB**, and **Socket.IO**.  
It handles user authentication, messaging, and real-time communication between connected users.

---

## 🚀 Features

- 🔐 **JWT-based authentication**
- 💬 **Real-time chat** with Socket.IO
- 👥 **User management** (registration, login, list/search users)
- 📨 **Message persistence** in MongoDB
- 🔎 **Search users** by name or email
- ⚙️ **CORS-enabled** for secure frontend-backend communication
- 🧱 **Modular route and controller structure**

---

## 🧰 Tech Stack

| Technology | Purpose |
|-------------|----------|
| **Node.js** | Runtime environment |
| **Express.js** | Web framework for building REST APIs |
| **MongoDB & Mongoose** | Database and ORM |
| **Socket.IO** | Real-time event-based communication |
| **JWT (jsonwebtoken)** | Authentication and authorization |
| **bcryptjs** | Password hashing |
| **cors** | Cross-Origin Resource Sharing |
| **dotenv** | Environment variable management |
| **nodemon** | Auto-reload during development |

---

## 📦 Dependencies

```json
"dependencies": {
  "bcryptjs": "^2.4.3",
  "cors": "^2.8.5",
  "dotenv": "^16.4.5",
  "express": "^4.18.2",
  "jsonwebtoken": "^9.0.2",
  "mongoose": "^8.4.1",
  "socket.io": "^4.7.5"
},
"devDependencies": {
  "nodemon": "^3.1.0"
}


git clone https://github.com/Kennedy1-svg/chat-application-be
cd chat-app-be

# Using npm
npm install

# OR using yarn
yarn install

