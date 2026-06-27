const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const seedPlayers = require('./config/seed');
const apiRoutes = require('./routes/api');
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: "*", // Adjust for production deployment as needed
    methods: ["GET", "POST"]
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

// Database connection & seeding startup
connectDB().then(() => {
  seedPlayers();
});

// Initialize Socket.IO Handler
socketHandler(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`RealDraft Backend Server running on port ${PORT}`);
});
