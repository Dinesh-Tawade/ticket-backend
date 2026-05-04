// models/Booking.js
const mongoose = require('mongoose');

const bookedSeatSchema = new mongoose.Schema({
  rowName: String,
  seatNumber: Number,
  category: String,
  price: Number
});

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  showId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Show',
    required: true
  },
  theaterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater'
  },
  movieName: String,
  showDate: Date,
  showTime: String,
  seats: [bookedSeatSchema],
  totalSeats: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'FREE'],
    default: 'PENDING'
  },
  bookingStatus: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED'],
    default: 'PENDING'
  },
  
  // ========== NEW FIELDS FOR QR & CHECK-IN ==========
  isCheckedIn: {
    type: Boolean,
    default: false
  },
  checkedInAt: {
    type: Date,
    default: null
  },
  checkedInBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  qrCodeGeneratedAt: {
    type: Date,
    default: null
  },
  
  bookedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  cancelledAt: Date,
  cancelledBy: {
    type: String,
    enum: ['USER', 'ADMIN', 'SYSTEM'],
    default: null
  }
});

// Generate unique booking ID
bookingSchema.pre('save', async function(next) {
  if (!this.bookingId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.bookingId = `BOOK${year}${month}${day}${random}`;
  }
  next();
});

// Add indexes for faster queries
bookingSchema.index({ bookingId: 1 });
bookingSchema.index({ showId: 1, bookingStatus: 1 });
bookingSchema.index({ theaterId: 1, isCheckedIn: 1 });
bookingSchema.index({ userId: 1, bookingStatus: 1 });

module.exports = mongoose.model('Booking', bookingSchema);