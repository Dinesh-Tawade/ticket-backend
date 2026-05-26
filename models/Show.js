const mongoose = require('mongoose');

// ==================== SEAT CATEGORY SCHEMA (UPDATED) ====================
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
        type: String,  // ✅ CHANGED: Number to String - now can store "A1", "D4", "E10"
        required: true
      },
      seatLabel: {
        type: String,  // ✅ ADDED: For custom seat labels
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
    type: Number, // in minutes
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
  seatCategories: [seatCategorySchema],
  isPaid: {
    type: Boolean,
    default: false
  },
  basePrice: {
    type: Number,
    default: 0,
    min: 0
  },
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
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==================== INDEXES ====================
showSchema.index({ theaterId: 1, screenId: 1, showDate: 1, startTime: 1 });
showSchema.index({ movie: 1, status: 1 });
showSchema.index({ showDate: 1, status: 1 });

// ==================== VIRTUAL FIELDS ====================
showSchema.virtual('isAvailable').get(function() {
  return this.status === 'BOOKING_OPEN' && this.availableSeats > 0;
});

showSchema.virtual('occupancyRate').get(function() {
  if (this.totalSeats === 0) return 0;
  return ((this.bookedSeatsCount / this.totalSeats) * 100).toFixed(2);
});

// ==================== PRE-SAVE MIDDLEWARE ====================
showSchema.pre('save', function(next) {
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
  
  // Auto-update status based on availability
  if (this.availableSeats === 0 && this.totalSeats > 0) {
    this.status = 'HOUSE_FULL';
  } else if (this.status === 'HOUSE_FULL' && this.availableSeats > 0) {
    this.status = 'BOOKING_OPEN';
  }
  
  next();
});

// ==================== METHODS ====================
showSchema.methods.updateSeatStatus = async function(seatNumber, isBooked, userId, bookingId) {
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
    // Recalculate totals
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

showSchema.methods.getAvailableSeats = function() {
  const availableSeats = [];
  
  this.seatCategories.forEach(category => {
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
showSchema.statics.findByTheater = function(theaterId) {
  return this.find({ theaterId }).sort({ showDate: 1, startTime: 1 });
};

showSchema.statics.findActiveShows = function() {
  return this.find({ 
    status: { $in: ['BOOKING_OPEN', 'COMING_SOON'] },
    showDate: { $gte: new Date() }
  }).sort({ showDate: 1, startTime: 1 });
};

showSchema.statics.findByDate = function(date) {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  
  return this.find({
    showDate: { $gte: startDate, $lte: endDate }
  }).sort({ startTime: 1 });
};

// ==================== EXPORT ====================
module.exports = mongoose.model('Show', showSchema);