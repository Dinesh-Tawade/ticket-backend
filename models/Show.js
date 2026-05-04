const mongoose = require('mongoose');

const seatCategorySchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['NORMAL', 'EXECUTIVE', 'PREMIUM', 'VIP', 'COUPLE'],
    required: true
  },
  rows: [{
    rowName: String,
    seats: [{
      seatNumber: Number,
      isBooked: { type: Boolean, default: false },
      bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null }
    }]
  }],
  pricePerSeat: {
    type: Number,
    required: true
  },
  totalSeats: Number,
  availableSeats: Number
});

const showSchema = new mongoose.Schema({
  theaterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater',
    required: true
  },
  screenId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  screenNumber: {
    type: Number,
    required: true
  },
  movie: {
    name: {
      type: String,
      required: true
    },
    poster: {
      type: String,
      default: null
    },
    genre: {
      type: String,
      enum: [
  'ACTION',
  'ADVENTURE',
  'ANIMATION',
  'BIOGRAPHY',
  'COMEDY',
  'CRIME',
  'DOCUMENTARY',
  'DRAMA',
  'FAMILY',
  'FANTASY',
  'FILM-NOIR',
  'HISTORY',
  'HORROR',
  'MUSIC',
  'MUSICAL',
  'MYSTERY',
  'ROMANCE',
  'SCI-FI',
  'SPORT',
  'THRILLER',
  'WAR',
  'WESTERN',
  'SUPERHERO',
  'PSYCHOLOGICAL',
  'DARK-COMEDY',
  'SATIRE',
  'SLASHER',
  'PARANORMAL',
  'ZOMBIE',
  'CYBERPUNK',
  'STEAMPUNK',
  'DYSTOPIAN',
  'UTOPIAN',
  'COMING-OF-AGE',
  'ROAD-MOVIE',
  'LEGAL',
  'POLITICAL',
  'RELIGIOUS',
  'MYTHOLOGY',
  'EPIC',
  'NOIR',
  'ROM-COM',
  'TRAGEDY',
  'MELODRAMA',
  'SURVIVAL',
  'DISASTER',
  'HEIST',
  'SPY',
  'GANGSTER',
  'MARTIAL-ARTS',
  'SUPER-NATURAL',
  'TIME-TRAVEL',
  'ALIEN',
  'MONSTER',
  'SPACE',
  'TEEN',
  'KIDS',
  'SHORT-FILM',
  'EXPERIMENTAL',
  'INDIE'
],
      required: true
    },
    duration: {
      type: Number, // in minutes
      required: true
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
  },
  showDate: {
    type: Date,
    required: true
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
    default: 0
  },
  status: {
    type: String,
    enum: ['COMING_SOON', 'BOOKING_OPEN', 'HOUSE_FULL', 'COMPLETED', 'CANCELLED'],
    default: 'BOOKING_OPEN'
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
    default: Date.now
  }
});

// Update available seats before saving
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
  });
  
  this.totalSeats = total;
  this.availableSeats = available;
  this.bookedSeatsCount = total - available;
  
  if (this.availableSeats === 0) {
    this.status = 'HOUSE_FULL';
  } else if (this.status === 'HOUSE_FULL') {
    this.status = 'BOOKING_OPEN';
  }
  
  next();
});

module.exports = mongoose.model('Show', showSchema);