const mongoose = require('mongoose');

// ==================== SEAT CATEGORY SCHEMA ====================
const seatCategorySchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['NORMAL', 'EXECUTIVE', 'PREMIUM', 'VIP', 'COUPLE'],
    required: true
  },
  rows: [{
    rowName: {
      type: String,
      required: true
    },
    seats: [{
      seatNumber: {
        type: String,
        required: true
      },
      seatLabel: {
        type: String,
        default: ''
      },
      isBooked: {
        type: Boolean,
        default: false
      },
      bookedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null
      },
      price: {
        type: Number,
        default: 0
      }
    }]
  }],
  pricePerSeat: {
    type: Number,
    required: true,
    min: 0
  },
  totalSeats: {
    type: Number,
    default: 0
  },
  availableSeats: {
    type: Number,
    default: 0
  }
});

// ==================== SHOW TIMING SCHEMA (NEW - For multiple timings) ====================
const showTimingSchema = new mongoose.Schema({
  showDate: {
    type: Date,
    required: true,
    index: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['COMING_SOON', 'BOOKING_OPEN', 'HOUSE_FULL', 'COMPLETED', 'CANCELLED'],
    default: 'BOOKING_OPEN'
  },
  seatCategories: [seatCategorySchema],
  totalSeats: {
    type: Number,
    default: 0
  },
  availableSeats: {
    type: Number,
    default: 0
  },
  bookedSeatsCount: {
    type: Number,
    default: 0
  }
});

// ==================== MOVIE SCHEMA ====================
const movieSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  poster: {
    type: String,
    default: null
  },
  genre: {
    type: String,
    enum: [
      'ACTION', 'ADVENTURE', 'ANIMATION', 'BIOGRAPHY', 'COMEDY', 'CRIME',
      'DOCUMENTARY', 'DRAMA', 'FAMILY', 'FANTASY', 'FILM-NOIR', 'HISTORY',
      'HORROR', 'MUSIC', 'MUSICAL', 'MYSTERY', 'ROMANCE', 'SCI-FI', 'SPORT',
      'THRILLER', 'WAR', 'WESTERN', 'SUPERHERO', 'PSYCHOLOGICAL', 'DARK-COMEDY',
      'SATIRE', 'SLASHER', 'PARANORMAL', 'ZOMBIE', 'CYBERPUNK', 'STEAMPUNK',
      'DYSTOPIAN', 'UTOPIAN', 'COMING-OF-AGE', 'ROAD-MOVIE', 'LEGAL', 'POLITICAL',
      'RELIGIOUS', 'MYTHOLOGY', 'EPIC', 'NOIR', 'ROM-COM', 'TRAGEDY', 'MELODRAMA',
      'SURVIVAL', 'DISASTER', 'HEIST', 'SPY', 'GANGSTER', 'MARTIAL-ARTS',
      'SUPER-NATURAL', 'TIME-TRAVEL', 'ALIEN', 'MONSTER', 'SPACE', 'TEEN',
      'KIDS', 'SHORT-FILM', 'EXPERIMENTAL', 'INDIE'
    ],
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 1
  },
  rating: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  description: {
    type: String,
    default: null
  },
  language: {
    type: String,
    required: true
  },
  isTrending: {
    type: Boolean,
    default: false
  },
  releaseDate: {
    type: Date,
    default: Date.now
  }
});

// ==================== MAIN SHOW SCHEMA ====================
const showSchema = new mongoose.Schema({
  // Core fields
  theaterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater',
    required: true,
    index: true
  },
  screenId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  screenNumber: {
    type: Number,
    required: true
  },
  movie: movieSchema,
  isPaid: {
    type: Boolean,
    default: false
  },
  basePrice: {
    type: Number,
    default: 0,
    min: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // ✅ NEW: Multiple timings support
  timings: [showTimingSchema],
  
  // ⚠️ LEGACY FIELDS (Keep for backward compatibility - will be deprecated)
  showDate: {
    type: Date,
    index: true
  },
  startTime: {
    type: String
  },
  endTime: {
    type: String
  },
  seatCategories: [seatCategorySchema],
  status: {
    type: String,
    enum: ['COMING_SOON', 'BOOKING_OPEN', 'HOUSE_FULL', 'COMPLETED', 'CANCELLED'],
    default: 'BOOKING_OPEN',
    index: true
  },
  totalSeats: {
    type: Number,
    default: 0
  },
  availableSeats: {
    type: Number,
    default: 0
  },
  bookedSeatsCount: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==================== INDEXES ====================
showSchema.index({ theaterId: 1, screenId: 1 });
showSchema.index({ 'timings.showDate': 1, 'timings.status': 1 });
showSchema.index({ showDate: 1, status: 1 }); // Legacy index

// ==================== VIRTUAL FIELDS ====================

// Check if show has multiple timings
showSchema.virtual('hasMultipleTimings').get(function() {
  return this.timings && this.timings.length > 0;
});

// Get all active timings
showSchema.virtual('activeTimings').get(function() {
  if (!this.timings) return [];
  return this.timings.filter(t => t.status === 'BOOKING_OPEN' && t.availableSeats > 0);
});

// Get upcoming timings
showSchema.virtual('upcomingTimings').get(function() {
  if (!this.timings) return [];
  const now = new Date();
  return this.timings.filter(t => new Date(t.showDate) >= now);
});

// Legacy virtuals (for backward compatibility)
showSchema.virtual('isAvailable').get(function() {
  if (this.timings && this.timings.length > 0) {
    return this.activeTimings.length > 0;
  }
  return this.status === 'BOOKING_OPEN' && this.availableSeats > 0;
});

showSchema.virtual('occupancyRate').get(function() {
  if (this.timings && this.timings.length > 0) {
    const totalSeats = this.timings.reduce((sum, t) => sum + t.totalSeats, 0);
    const bookedSeats = this.timings.reduce((sum, t) => sum + t.bookedSeatsCount, 0);
    if (totalSeats === 0) return 0;
    return ((bookedSeats / totalSeats) * 100).toFixed(2);
  }
  if (this.totalSeats === 0) return 0;
  return ((this.bookedSeatsCount / this.totalSeats) * 100).toFixed(2);
});

// ==================== PRE-SAVE MIDDLEWARE ====================
showSchema.pre('save', function(next) {
  // If timings exist, sync legacy fields from first timing (for backward compatibility)
  if (this.timings && this.timings.length > 0) {
    const firstTiming = this.timings[0];
    this.showDate = firstTiming.showDate;
    this.startTime = firstTiming.startTime;
    this.endTime = firstTiming.endTime;
    this.seatCategories = firstTiming.seatCategories;
    this.status = firstTiming.status;
    this.totalSeats = firstTiming.totalSeats;
    this.availableSeats = firstTiming.availableSeats;
    this.bookedSeatsCount = firstTiming.bookedSeatsCount;
  } else if (this.seatCategories && this.seatCategories.length > 0) {
    // Legacy mode: calculate totals
    let total = 0;
    let available = 0;
    
    this.seatCategories.forEach(category => {
      category.rows.forEach(row => {
        row.seats.forEach(seat => {
          total++;
          if (!seat.isBooked) available++;
        });
      });
      category.totalSeats = category.rows.reduce((sum, row) => sum + row.seats.length, 0);
      category.availableSeats = category.rows.reduce((sum, row) => sum + row.seats.filter(s => !s.isBooked).length, 0);
    });
    
    this.totalSeats = total;
    this.availableSeats = available;
    this.bookedSeatsCount = total - available;
    
    // Auto-update status
    if (this.availableSeats === 0 && this.totalSeats > 0) {
      this.status = 'HOUSE_FULL';
    } else if (this.status === 'HOUSE_FULL' && this.availableSeats > 0) {
      this.status = 'BOOKING_OPEN';
    }
  }
  
  next();
});

// ==================== METHODS ====================

// Get a specific timing by ID
showSchema.methods.getTimingById = function(timingId) {
  if (!this.timings) return null;
  return this.timings.find(t => t._id.toString() === timingId);
};

// Update seat status for a specific timing (NEW - for multiple timings)
showSchema.methods.updateSeatStatusForTiming = async function(timingId, seatNumber, isBooked, userId, bookingId) {
  const timing = this.timings?.find(t => t._id.toString() === timingId);
  if (!timing) return false;
  
  let seatFound = false;
  
  for (const category of timing.seatCategories) {
    for (const row of category.rows) {
      const seat = row.seats.find(s => s.seatNumber === seatNumber);
      if (seat) {
        seat.isBooked = isBooked;
        if (isBooked) {
          seat.bookedBy = userId;
          seat.bookingId = bookingId;
        } else {
          seat.bookedBy = null;
          seat.bookingId = null;
        }
        seatFound = true;
        break;
      }
    }
    if (seatFound) break;
  }
  
  if (seatFound) {
    // Recalculate totals for this timing
    let total = 0;
    let available = 0;
    
    timing.seatCategories.forEach(category => {
      category.rows.forEach(row => {
        row.seats.forEach(seat => {
          total++;
          if (!seat.isBooked) available++;
        });
      });
      category.totalSeats = category.rows.reduce((sum, row) => sum + row.seats.length, 0);
      category.availableSeats = category.rows.reduce((sum, row) => sum + row.seats.filter(s => !s.isBooked).length, 0);
    });
    
    timing.totalSeats = total;
    timing.availableSeats = available;
    timing.bookedSeatsCount = total - available;
    
    // Auto-update timing status
    if (timing.availableSeats === 0 && timing.totalSeats > 0) {
      timing.status = 'HOUSE_FULL';
    } else if (timing.status === 'HOUSE_FULL' && timing.availableSeats > 0) {
      timing.status = 'BOOKING_OPEN';
    }
    
    // Sync legacy fields
    const firstTiming = this.timings[0];
    this.showDate = firstTiming.showDate;
    this.startTime = firstTiming.startTime;
    this.endTime = firstTiming.endTime;
    this.seatCategories = firstTiming.seatCategories;
    this.status = firstTiming.status;
    this.totalSeats = firstTiming.totalSeats;
    this.availableSeats = firstTiming.availableSeats;
    this.bookedSeatsCount = firstTiming.bookedSeatsCount;
    
    await this.save();
    return true;
  }
  
  return false;
};

// Legacy updateSeatStatus (for backward compatibility)
showSchema.methods.updateSeatStatus = async function(seatNumber, isBooked, userId, bookingId) {
  // If has timings, use timing method
  if (this.timings && this.timings.length > 0) {
    // Default to first timing if no timingId provided
    return this.updateSeatStatusForTiming(this.timings[0]._id, seatNumber, isBooked, userId, bookingId);
  }
  
  // Legacy mode
  let seatFound = false;
  
  for (const category of this.seatCategories) {
    for (const row of category.rows) {
      const seat = row.seats.find(s => s.seatNumber === seatNumber);
      if (seat) {
        seat.isBooked = isBooked;
        if (isBooked) {
          seat.bookedBy = userId;
          seat.bookingId = bookingId;
        } else {
          seat.bookedBy = null;
          seat.bookingId = null;
        }
        seatFound = true;
        break;
      }
    }
    if (seatFound) break;
  }
  
  if (seatFound) {
    let total = 0;
    let available = 0;
    
    this.seatCategories.forEach(category => {
      category.rows.forEach(row => {
        row.seats.forEach(seat => {
          total++;
          if (!seat.isBooked) available++;
        });
      });
      category.totalSeats = category.rows.reduce((sum, row) => sum + row.seats.length, 0);
      category.availableSeats = category.rows.reduce((sum, row) => sum + row.seats.filter(s => !s.isBooked).length, 0);
    });
    
    this.totalSeats = total;
    this.availableSeats = available;
    this.bookedSeatsCount = total - available;
    
    await this.save();
    return true;
  }
  
  return false;
};

// Get available seats (with optional timingId)
showSchema.methods.getAvailableSeats = function(timingId = null) {
  // If timingId provided and has timings
  if (timingId && this.timings) {
    const timing = this.timings.find(t => t._id.toString() === timingId);
    if (timing) {
      const availableSeats = [];
      timing.seatCategories.forEach(category => {
        category.rows.forEach(row => {
          row.seats.forEach(seat => {
            if (!seat.isBooked) {
              availableSeats.push({
                seatNumber: seat.seatNumber,
                seatLabel: seat.seatLabel || seat.seatNumber,
                category: category.category,
                price: category.pricePerSeat,
                rowName: row.rowName
              });
            }
          });
        });
      });
      return availableSeats;
    }
  }
  
  // Legacy mode or default timing
  const availableSeats = [];
  const categories = this.seatCategories || (this.timings?.[0]?.seatCategories || []);
  
  categories.forEach(category => {
    category.rows.forEach(row => {
      row.seats.forEach(seat => {
        if (!seat.isBooked) {
          availableSeats.push({
            seatNumber: seat.seatNumber,
            seatLabel: seat.seatLabel || seat.seatNumber,
            category: category.category,
            price: category.pricePerSeat,
            rowName: row.rowName
          });
        }
      });
    });
  });
  
  return availableSeats;
};

// ==================== STATIC METHODS ====================

// Find shows by theater
showSchema.statics.findByTheater = function(theaterId) {
  return this.find({ theaterId });
};

// Find active shows (considering timings)
showSchema.statics.findActiveShows = function() {
  const now = new Date();
  return this.find({
    $or: [
      { timings: { $exists: true, $not: { $size: 0 } }, 'timings.showDate': { $gte: now }, 'timings.status': 'BOOKING_OPEN' },
      { status: { $in: ['BOOKING_OPEN', 'COMING_SOON'] }, showDate: { $gte: now } }
    ]
  });
};

// Find shows by date
showSchema.statics.findByDate = function(date) {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  
  return this.find({
    $or: [
      { 'timings.showDate': { $gte: startDate, $lte: endDate } },
      { showDate: { $gte: startDate, $lte: endDate } }
    ]
  });
};

showSchema.methods.isBookingAvailable = async function(timingId = null) {
  try {
    // Import BookingSettings model (will be created separately)
    const BookingSettings = mongoose.model('BookingSettings');
    
    // Determine which timing to check
    let targetTiming = null;
    let targetShowDate = null;
    let targetStartTime = null;
    
    if (timingId && this.timings && this.timings.length > 0) {
      // Check specific timing
      targetTiming = this.timings.find(t => t._id.toString() === timingId);
      if (!targetTiming) {
        return { available: false, reason: 'Timing not found.' };
      }
      targetShowDate = targetTiming.showDate;
      targetStartTime = targetTiming.startTime;
      
      // Check timing status
      if (targetTiming.status !== 'BOOKING_OPEN') {
        return { available: false, reason: `Booking is ${targetTiming.status.toLowerCase().replace('_', ' ')} for this timing.` };
      }
      
      // Check if timing has available seats
      if (targetTiming.availableSeats <= 0) {
        return { available: false, reason: 'No seats available for this timing.' };
      }
    } else {
      // Legacy mode - check main show
      if (this.status !== 'BOOKING_OPEN') {
        return { available: false, reason: `Booking is ${this.status.toLowerCase().replace('_', ' ')} for this show.` };
      }
      
      if (this.availableSeats <= 0) {
        return { available: false, reason: 'No seats available.' };
      }
      
      targetShowDate = this.showDate;
      targetStartTime = this.startTime;
    }
    
    // Check if show date has passed
    let showDateTime;
    if (targetShowDate && targetStartTime) {
      showDateTime = new Date(targetShowDate);
      if (targetStartTime) {
        const [hours, minutes] = targetStartTime.split(':');
        showDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }
      
      if (showDateTime < new Date()) {
        return { available: false, reason: 'This show has already started.' };
      }
    }
    
    // Get global booking settings
    let settings = await BookingSettings.findOne();
    
    if (!settings) {
      // Create default settings if none exist
      settings = await BookingSettings.create({});
    }
    
    // Check booking availability from settings
    const bookingStatus = await settings.isBookingEnabledForShow(
      this._id, 
      targetShowDate || this.showDate,
      timingId
    );
    
    return {
      available: bookingStatus.enabled,
      reason: bookingStatus.reason,
      settings: {
        maxTicketsPerBooking: settings.maxTicketsPerBooking,
        isMaintenanceMode: settings.isMaintenanceMode
      }
    };
  } catch (error) {
    console.error('Error checking booking availability:', error);
    // Default to allowing booking if settings check fails (fail open)
    return { 
      available: true, 
      reason: null,
      settings: { maxTicketsPerBooking: 10, isMaintenanceMode: false }
    };
  }
};


// ==================== EXPORT ====================
module.exports = mongoose.model('Show', showSchema);