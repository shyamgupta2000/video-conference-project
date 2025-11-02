// server.js
// WebRTC Signaling Server with Express and Socket.io

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS || '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(helmet({
  contentSecurityPolicy: false  // Allow inline scripts for demo
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage for rooms
const rooms = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    uptime: process.uptime()
  });
});

// API: Create room
app.post('/api/room/create', (req, res) => {
  const roomId = generateRoomId();
  rooms.set(roomId, {
    id: roomId,
    participants: [],
    createdAt: new Date()
  });
  
  console.log(`[API] Room created: ${roomId}`);
  res.json({ roomId, url: `${req.protocol}://${req.get('host')}/?room=${roomId}` });
});

// API: Get room info
app.get('/api/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({
    roomId: room.id,
    participants: room.participants.length,
    createdAt: room.createdAt
  });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io signaling
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Join room
  socket.on('join-room', ({ roomId, userName }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName || 'Anonymous';

    // Update room participants
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        participants: [],
        createdAt: new Date()
      });
    }
    
    const room = rooms.get(roomId);
    room.participants.push({
      socketId: socket.id,
      userName: socket.userName
    });

    console.log(`[Room ${roomId}] ${socket.userName} joined`);

    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userName: socket.userName
    });

    // Send existing participants to new user
    const otherParticipants = room.participants
      .filter(p => p.socketId !== socket.id)
      .map(p => ({ socketId: p.socketId, userName: p.userName }));
    
    socket.emit('existing-participants', otherParticipants);
  });

  // WebRTC Signaling: Offer
  socket.on('offer', ({ offer, to }) => {
    console.log(`[Signal] Offer from ${socket.id} to ${to}`);
    io.to(to).emit('offer', {
      offer,
      from: socket.id,
      userName: socket.userName
    });
  });

  // WebRTC Signaling: Answer
  socket.on('answer', ({ answer, to }) => {
    console.log(`[Signal] Answer from ${socket.id} to ${to}`);
    io.to(to).emit('answer', {
      answer,
      from: socket.id
    });
  });

  // WebRTC Signaling: ICE Candidate
  socket.on('ice-candidate', ({ candidate, to }) => {
    io.to(to).emit('ice-candidate', {
      candidate,
      from: socket.id
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
    
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        room.participants = room.participants.filter(p => p.socketId !== socket.id);
        
        // Clean up empty rooms
        if (room.participants.length === 0) {
          rooms.delete(socket.roomId);
          console.log(`[Room ${socket.roomId}] Deleted (empty)`);
        }
      }

      // Notify others
      socket.to(socket.roomId).emit('user-left', {
        socketId: socket.id,
        userName: socket.userName
      });
    }
  });
});

// Helper function to generate room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 10);
}

// Start server
server.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🎥 Video Conference Server with Face Detection              ║
║                                                              ║
║  Server running on: http://${HOST}:${PORT}                      ║
║  Environment: ${process.env.NODE_ENV || 'development'}                                    ║
║                                                              ║
║  Health Check: http://${HOST}:${PORT}/health                    ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});