const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');

// Load env vars
dotenv.config();

// Connect to database - forced restart trigger
connectDB();

const app = express();
const server = http.createServer(app);

// ==================== SOCKET.IO ====================
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://192.168.1.10:3000"],
    credentials: true
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  socket.on('vendor-join', (vendorId) => {
    if (vendorId) {
      socket.join(`vendor_${vendorId}`);
      console.log(`📱 Vendor ${vendorId} joined`);
    }
  });

  socket.on('buyer-join', (buyerId) => {
    if (buyerId) {
      socket.join(`buyer_${buyerId}`);
      console.log(`👤 Buyer ${buyerId} joined`);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
  });
});

// ==================== MIDDLEWARE ====================
// Ensure upload directories exist
const uploadDirs = ['./uploads/profiles', './uploads/theaters', './uploads/products', './uploads/misc'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// CORS
app.use(cors());

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api', require('./routes/index'));

// ==================== ERROR HANDLERS ====================
// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong!'
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API URL: http://localhost:${PORT}/api`);
  console.log(`📁 Uploads URL: http://localhost:${PORT}/uploads`);
  console.log(`🔌 Socket URL: ws://localhost:${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
});