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

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);

// ==================== CONFIG FROM ENV ====================
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';
const NODE_ENV = process.env.NODE_ENV || 'development';
const BODY_LIMIT = process.env.BODY_LIMIT || '50mb';

// Parse allowed CORS origins from env  (comma-separated list)
// Example: CORS_ORIGINS=https://yourapp.com,https://www.yourapp.com
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

// ==================== SOCKET.IO ====================
const io = socketIo(server, {
  cors: {
    origin: CORS_ORIGINS,
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
const UPLOAD_BASE = process.env.UPLOAD_PATH || './uploads';
const uploadDirs = [
  `${UPLOAD_BASE}/profiles`,
  `${UPLOAD_BASE}/theaters`,
  `${UPLOAD_BASE}/products`,
  `${UPLOAD_BASE}/misc`
];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ==================== CORS ====================
// In production: set CORS_ORIGINS env var on Render as comma-separated URLs
// e.g. CORS_ORIGINS=https://ticket-frontend-rfda.onrender.com,https://www.yourapp.com
// In development: defaults to allowing localhost:3000
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`🚫 CORS blocked origin: ${origin}`);
    return callback(new Error(`CORS policy does not allow origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Handle preflight OPTIONS requests for all routes
app.options('*', cors(corsOptions));

console.log(`🌐 CORS allowed origins: ${CORS_ORIGINS.join(', ')}`);

// Body parsing
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, UPLOAD_BASE)));

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
  if (NODE_ENV !== 'production') {
    console.error('Error:', err.stack);
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong!'
  });
});

// ==================== START SERVER ====================
const BASE_URL = process.env.BASE_URL || `http://${HOST}:${PORT}`;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API URL: ${BASE_URL}/api`);
  console.log(`📁 Uploads URL: ${BASE_URL}/uploads`);
  console.log(`🔌 Socket URL: ws://${HOST}:${PORT}`);
  console.log(`✅ Environment: ${NODE_ENV}`);
});