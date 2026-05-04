const mongoose = require('mongoose');

const bookedSeatSchema = new mongoose.Schema({
  rowName: {
    type: String,
    required: true
  },
  seatNumber: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['NORMAL', 'EXECUTIVE', 'PREMIUM', 'VIP', 'COUPLE'],
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  // For individual seat check-in (if multi-seat ticket)
  isSeatCheckedIn: {
    type: Boolean,
    default: false
  },
  seatCheckedInAt: {
    type: Date,
    default: null
  }
});

const bookingSchema = new mongoose.Schema({
  // ==================== BASIC INFO ====================
  bookingId: {
    type: String,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  showId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Show',
    required: true,
    index: true
  },
  theaterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater',
    required: true,
    index: true
  },
  
  // ==================== SHOW DETAILS (Denormalized for quick access) ====================
  movieName: {
    type: String,
    required: true
  },
  moviePoster: {
    type: String,
    default: null
  },
  showDate: {
    type: Date,
    required: true
  },
  showTime: {
    type: String,
    required: true
  },
  screenNumber: {
    type: Number,
    default: 1
  },
  
  // ==================== SEAT DETAILS ====================
  seats: [bookedSeatSchema],
  totalSeats: {
    type: Number,
    required: true,
    min: 1,
    max: 40
  },
  
  // ==================== PAYMENT DETAILS ====================
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'FREE', 'REFUNDED'],
    default: 'PAID',
    index: true
  },
  paymentId: {
    type: String,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['ONLINE', 'CASH', 'CARD', 'UPI', null],
    default: null
  },
  paymentDetails: {
    type: Object,
    default: null
  },
  
  // ==================== BOOKING STATUS ====================
  bookingStatus: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'REFUNDED'],
    default: 'CONFIRMED',
    index: true
  },
  
  // ==================== QR CODE & CHECK-IN (NEW) ====================
  qrCode: {
    type: String,
    default: null
  },
  qrData: {
    type: String,
    default: null
  },
  qrCodeGeneratedAt: {
    type: Date,
    default: null
  },
  
  // Overall booking check-in status
  isCheckedIn: {
    type: Boolean,
    default: false,
    index: true
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
  
  // Partial check-in (some seats checked in, some not)
  partialCheckIn: {
    type: Boolean,
    default: false
  },
  checkedInSeatsCount: {
    type: Number,
    default: 0
  },
  
  // ==================== TIMESTAMPS ====================
  bookedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  confirmedAt: {
    type: Date,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancelledBy: {
    type: String,
    enum: ['USER', 'ADMIN', 'SYSTEM'],
    default: null
  },
  cancellationReason: {
    type: String,
    default: null
  },
  
  // ==================== SNACKS ORDER LINK ====================
  snacksOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  
  // ==================== NOTIFICATION STATUS ====================
  notificationSent: {
    type: Boolean,
    default: false
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  smsSent: {
    type: Boolean,
    default: false
  },
  
  // ==================== ADDITIONAL INFO ====================
  specialRequests: {
    type: String,
    default: null
  },
  source: {
    type: String,
    enum: ['APP', 'WEB', 'COUNTER', 'ADMIN'],
    default: 'APP'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true,  // Adds createdAt and updatedAt automatically
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==================== INDEXES ====================
// Compound indexes for faster queries
bookingSchema.index({ showId: 1, bookingStatus: 1 });
bookingSchema.index({ theaterId: 1, showDate: 1 });
bookingSchema.index({ theaterId: 1, isCheckedIn: 1 });
bookingSchema.index({ userId: 1, bookingStatus: 1, createdAt: -1 });
bookingSchema.index({ qrCode: 1 });
bookingSchema.index({ expiresAt: 1 });

// ==================== PRE-SAVE HOOKS ====================

// Generate unique booking ID
bookingSchema.pre('save', async function(next) {
  if (!this.bookingId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    this.bookingId = `BKG${year}${month}${day}${random}`;
  }
  
  // Generate QR data if not exists
  if (!this.qrData && this.bookingId && this.seats && this.seats.length > 0) {
    const firstSeat = this.seats[0];
    this.qrData = `${this.bookingId}|${firstSeat.rowName}|${firstSeat.seatNumber}|${firstSeat.rowName}${firstSeat.seatNumber}`;
  }
  
  next();
});

// Update timestamps on status change
bookingSchema.pre('save', function(next) {
  if (this.isModified('bookingStatus')) {
    if (this.bookingStatus === 'CONFIRMED' && !this.confirmedAt) {
      this.confirmedAt = new Date();
    }
    if (this.bookingStatus === 'CANCELLED' && !this.cancelledAt) {
      this.cancelledAt = new Date();
    }
  }
  
  if (this.isModified('isCheckedIn') && this.isCheckedIn && !this.checkedInAt) {
    this.checkedInAt = new Date();
  }
  
  next();
});

// ==================== VIRTUAL FIELDS ====================

// Check if booking can be cancelled
bookingSchema.virtual('canBeCancelled').get(function() {
  if (this.bookingStatus !== 'CONFIRMED') return false;
  if (this.isCheckedIn) return false;
  
  // Check if show time is more than 2 hours away
  const showDateTime = new Date(this.showDate);
  const [hours, minutes] = (this.showTime || '00:00').split(':');
  showDateTime.setHours(parseInt(hours), parseInt(minutes));
  
  const hoursDifference = (showDateTime - new Date()) / (1000 * 60 * 60);
  return hoursDifference > 2;
});

// Get checked-in seats count
bookingSchema.virtual('checkedInSeatsList').get(function() {
  return this.seats.filter(seat => seat.isSeatCheckedIn);
});

// Check if all seats are checked in
bookingSchema.virtual('allSeatsCheckedIn').get(function() {
  return this.seats.length > 0 && this.seats.every(seat => seat.isSeatCheckedIn);
});

// ==================== INSTANCE METHODS ====================

// Mark a specific seat as checked in
bookingSchema.methods.checkInSeat = async function(seatRow, seatNumber, checkedBy) {
  const seat = this.seats.find(s => s.rowName === seatRow && s.seatNumber === seatNumber);
  
  if (!seat) {
    throw new Error('Seat not found in this booking');
  }
  
  if (seat.isSeatCheckedIn) {
    throw new Error('Seat already checked in');
  }
  
  seat.isSeatCheckedIn = true;
  seat.seatCheckedInAt = new Date();
  
  // Update booking check-in counts
  this.checkedInSeatsCount = this.seats.filter(s => s.isSeatCheckedIn).length;
  
  if (this.checkedInSeatsCount === this.seats.length) {
    this.isCheckedIn = true;
    this.checkedInAt = new Date();
    this.checkedInBy = checkedBy;
    this.partialCheckIn = false;
  } else {
    this.partialCheckIn = true;
  }
  
  await this.save();
  return seat;
};

// Mark entire booking as checked in
bookingSchema.methods.checkInAll = async function(checkedBy) {
  if (this.isCheckedIn) {
    throw new Error('Booking already checked in');
  }
  
  for (const seat of this.seats) {
    if (!seat.isSeatCheckedIn) {
      seat.isSeatCheckedIn = true;
      seat.seatCheckedInAt = new Date();
    }
  }
  
  this.isCheckedIn = true;
  this.checkedInAt = new Date();
  this.checkedInBy = checkedBy;
  this.checkedInSeatsCount = this.seats.length;
  this.partialCheckIn = false;
  
  await this.save();
  return this;
};

// Generate QR data for specific seat
bookingSchema.methods.generateSeatQRData = function(seatRow, seatNumber) {
  const seat = this.seats.find(s => s.rowName === seatRow && s.seatNumber === seatNumber);
  if (!seat) return null;
  return `${this.bookingId}|${seat.rowName}|${seat.seatNumber}|${seat.rowName}${seat.seatNumber}`;
};

// ==================== STATIC METHODS ====================

// Find active bookings for a show
bookingSchema.statics.findActiveBookingsForShow = function(showId) {
  return this.find({
    showId,
    bookingStatus: 'CONFIRMED',
    paymentStatus: { $in: ['PAID', 'FREE'] }
  }).populate('userId', 'name email phone');
};

// Get check-in statistics for a show
bookingSchema.statics.getCheckInStats = async function(showId) {
  const bookings = await this.find({ showId, bookingStatus: 'CONFIRMED' });
  
  const totalTickets = bookings.reduce((sum, b) => sum + b.seats.length, 0);
  const checkedInTickets = bookings.reduce((sum, b) => sum + (b.checkedInSeatsCount || 0), 0);
  const fullyCheckedIn = bookings.filter(b => b.isCheckedIn).length;
  const partiallyCheckedIn = bookings.filter(b => b.partialCheckIn).length;
  
  return {
    totalBookings: bookings.length,
    totalTickets,
    checkedInTickets,
    remainingTickets: totalTickets - checkedInTickets,
    fullyCheckedIn,
    partiallyCheckedIn,
    checkInPercentage: totalTickets > 0 ? (checkedInTickets / totalTickets) * 100 : 0
  };
};

// Auto-cancel expired pending bookings
bookingSchema.statics.autoCancelExpiredBookings = async function() {
  const result = await this.updateMany(
    {
      bookingStatus: 'PENDING',
      expiresAt: { $lt: new Date() }
    },
    {
      $set: {
        bookingStatus: 'EXPIRED',
        cancelledAt: new Date(),
        cancelledBy: 'SYSTEM'
      }
    }
  );
  return result;
};

module.exports = mongoose.model('Booking', bookingSchema);