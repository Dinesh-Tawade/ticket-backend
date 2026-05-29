const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

// ==================== SEAT SCHEMA (Individual Seat) - DEFINED FIRST ====================
const seatSchema = new mongoose.Schema({
  seatId: {
    type: String,
    required: true
  },
  seatNumber: {
    type: String,  // e.g., "A1", "B12", "C5"
    required: true
  },
  seatLabel: {
    type: String,  // Custom label if different from seatNumber
    required: true
  },
  rowNumber: {
    type: Number,
    required: true
  },
  columnNumber: {
    type: Number,
    required: true
  },
  rowName: {
    type: String,  // "A", "B", "C", etc.
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isBooked: {
    type: Boolean,
    default: false
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    default: 0
  },
  seatType: {
    type: String,
    enum: ['NORMAL', 'EXECUTIVE', 'PREMIUM', 'VIP', 'COUPLE'],
    default: 'NORMAL'
  }
});

// ==================== ROW SCHEMA ====================
const rowSchema = new mongoose.Schema({
  rowId: {
    type: String,
    required: true,
    unique: true
  },
  rowName: {
    type: String,  // "A", "B", "C", etc.
    required: true
  },
  rowNumber: {
    type: Number,
    required: true
  },
  seatCount: {
    type: Number,
    required: true,
    min: 1,
    max: 50
  },
  seats: {
    type: [seatSchema],
    default: []
  },
  category: {
    type: String,
    enum: ['NORMAL', 'EXECUTIVE', 'PREMIUM', 'VIP', 'COUPLE'],
    default: 'NORMAL'
  },
  priceMultiplier: {
    type: Number,
    default: 1.0
  }
});

// ==================== ZONE SCHEMA ====================
const zoneSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  zoneNumber: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt
  },
  position: {
    type: String,
    enum: ['center', 'left', 'right', 'top', 'bottom'],
    default: 'center'
  },
  positionLabel: {
    type: String,
    default: 'Center Stage'
  },
  seatType: {
    type: String,
    enum: ['NORMAL', 'EXECUTIVE', 'PREMIUM', 'VIP', 'COUPLE'],
    default: 'NORMAL'
  },
  color: {
    type: String,
    default: '#3b82f6'
  },
  icon: {
    type: String,
    default: '■'
  },
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  priceMultiplier: {
    type: Number,
    default: 1.0,
    min: 0.5,
    max: 5.0
  },
  finalPrice: {
    type: Number,
    default: 0
  },
   noSeat: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: ""
  },
  totalRows: {
    type: Number,
    required: true,
    min: 0
  },
  totalSeats: {
    type: Number,
    required: true,
    min: 0
  },
  rows: {
    type: [rowSchema],
    default: []
  },
  // noSeat: {
  // type: Boolean,
  // default: false
  // },
  // label: {
  //   type: String,
  //   default: ''
  // },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'],
    default: 'ACTIVE'
  }
});

// Pre-save middleware to calculate finalPrice
zoneSchema.pre('save', function(next) {
  this.finalPrice = this.basePrice * this.priceMultiplier;
  next();
});

// ==================== SCREEN SCHEMA (Legacy Support + New Zone System) ====================
const screenSchema = new mongoose.Schema({
  screenNumber: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    default: null,
    set: encrypt,
    get: decrypt
  },
  
  // Legacy fields (for backward compatibility)
  totalRows: {
    type: Number,
    default: 0
  },
  totalColumns: {
    type: Number,
    default: 0
  },
  seatRows: {
    type: [{
      rowName: String,
      category: String,
      startSeat: Number,
      endSeat: Number,
      priceMultiplier: Number
    }],
    default: []
  },
  
  // New zone-based layout system
  position: {
    type: String,
    enum: ['center', 'left', 'right', 'top', 'bottom'],
    default: 'center'
  },
  positionLabel: {
    type: String,
    default: 'Center Stage'
  },
  zones: {
    type: [zoneSchema],
    default: []
  },
  totalZones: {
    type: Number,
    default: 0
  },
  totalSeatsInScreen: {
    type: Number,
    default: 0
  },
  
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'],
    default: 'ACTIVE'
  }
}, { toJSON: { getters: true }, toObject: { getters: true } });

// ==================== THEATER SCHEMA ====================
const theaterSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt,
    index: true
  },
  location: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt
  },
  city: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt,
    index: true
  },
  state: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt
  },
  pincode: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt
  },
  contactNumber: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt
  },
  
  // Amenities
  hasRecliner: {
    type: Boolean,
    default: false
  },
  hasWifi: {
    type: Boolean,
    default: false
  },
  hasParking: {
    type: Boolean,
    default: false
  },
  hasCafe: {
    type: Boolean,
    default: false
  },
  hasWheelchair: {
    type: Boolean,
    default: false
  },
  
  // Screens/Auditoriums
  screens: {
    type: [screenSchema],
    default: []
  },
  totalScreens: {
    type: Number,
    default: 0
  },
  totalSeats: {
    type: Number,
    default: 0
  },
  totalZones: {
    type: Number,
    default: 0
  },
  
  // Layout configuration
  screenPosition: {
    type: String,
    enum: ['top', 'bottom'],
    default: 'top'
  },
  layout: {
    type: Object,
    default: {}
  },
  layoutMeta: {
    type: Object,
    default: {},
    description: 'Metadata for layout builder (zones, aisles, row naming, etc.)'
  },
  
  // Images
  images: {
    type: [{
      url: String,
      type: {
        type: String,
        enum: ['exterior', 'interior', 'screen', 'lobby', 'other'],
        default: 'other'
      },
      isPrimary: {
        type: Boolean,
        default: false
      }
    }],
    default: []
  },
  
  // Status fields
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED'],
    default: 'PENDING',
    index: true
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  toJSON: { getters: true }, 
  toObject: { getters: true },
  timestamps: true
});

// ==================== INDEXES ====================
theaterSchema.index({ ownerId: 1, status: 1 });
theaterSchema.index({ city: 1, status: 1 });
theaterSchema.index({ name: 'text', location: 'text', city: 'text' });

// ==================== VIRTUAL FIELDS ====================
theaterSchema.virtual('isActive').get(function() {
  return this.status === 'ACTIVE';
});

theaterSchema.virtual('formattedAddress').get(function() {
  return `${this.location}, ${this.city}, ${this.state} - ${this.pincode}`;
});

// ==================== METHODS ====================
theaterSchema.methods.calculateTotalSeats = function() {
  let total = 0;
  this.screens.forEach(screen => {
    if (screen.zones && screen.zones.length > 0) {
      // New zone-based calculation
      screen.zones.forEach(zone => {
        total += zone.totalSeats;
      });
    } else if (screen.seatRows && screen.seatRows.length > 0) {
      // Legacy calculation
      screen.seatRows.forEach(row => {
        total += (row.endSeat - row.startSeat + 1);
      });
    }
  });
  this.totalSeats = total;
  return total;
};

theaterSchema.methods.calculateTotalZones = function() {
  let total = 0;
  this.screens.forEach(screen => {
    if (screen.zones) {
      total += screen.zones.length;
    }
  });
  this.totalZones = total;
  return total;
};

theaterSchema.methods.calculateTotalScreens = function() {
  this.totalScreens = this.screens.length;
  return this.totalScreens;
};

theaterSchema.methods.updateTotals = function() {
  this.calculateTotalScreens();
  this.calculateTotalZones();
  this.calculateTotalSeats();
  return this;
};

// ==================== STATIC METHODS ====================
theaterSchema.statics.findByOwner = function(ownerId) {
  return this.find({ ownerId, status: { $ne: 'SUSPENDED' } });
};

theaterSchema.statics.findActive = function() {
  return this.find({ status: 'ACTIVE' });
};

theaterSchema.statics.findByCity = function(city) {
  return this.find({ city: new RegExp(city, 'i'), status: 'ACTIVE' });
};

// ==================== PRE-SAVE MIDDLEWARE ====================
theaterSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.updateTotals();
  next();
});

theaterSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// ==================== HELPER FUNCTIONS FOR ZONE CREATION ====================
theaterSchema.methods.addZoneToScreen = function(screenIndex, zoneData) {
  if (!this.screens[screenIndex]) {
    throw new Error('Screen not found');
  }
  if (!this.screens[screenIndex].zones) {
    this.screens[screenIndex].zones = [];
  }
  this.screens[screenIndex].zones.push(zoneData);
  this.screens[screenIndex].totalZones = this.screens[screenIndex].zones.length;
  this.updateTotals();
  return this;
};

theaterSchema.methods.updateZoneInScreen = function(screenIndex, zoneIndex, zoneData) {
  if (!this.screens[screenIndex] || !this.screens[screenIndex].zones[zoneIndex]) {
    throw new Error('Zone not found');
  }
  this.screens[screenIndex].zones[zoneIndex] = { ...this.screens[screenIndex].zones[zoneIndex].toObject(), ...zoneData };
  this.updateTotals();
  return this;
};

theaterSchema.methods.removeZoneFromScreen = function(screenIndex, zoneIndex) {
  if (!this.screens[screenIndex]) {
    throw new Error('Screen not found');
  }
  this.screens[screenIndex].zones.splice(zoneIndex, 1);
  this.screens[screenIndex].totalZones = this.screens[screenIndex].zones.length;
  this.updateTotals();
  return this;
};

// ==================== HELPER FUNCTIONS FOR SEAT MANAGEMENT ====================
theaterSchema.methods.updateSeatInZone = function(screenIndex, zoneIndex, rowIndex, seatIndex, seatData) {
  const zone = this.screens[screenIndex]?.zones[zoneIndex];
  if (!zone) throw new Error('Zone not found');
  
  const seat = zone.rows[rowIndex]?.seats[seatIndex];
  if (!seat) throw new Error('Seat not found');
  
  Object.assign(seat, seatData);
  return this;
};

theaterSchema.methods.updateRowSeatCount = function(screenIndex, zoneIndex, rowIndex, newSeatCount) {
  const zone = this.screens[screenIndex]?.zones[zoneIndex];
  if (!zone) throw new Error('Zone not found');
  
  const row = zone.rows[rowIndex];
  if (!row) throw new Error('Row not found');
  
  // Update seat count and regenerate seats
  row.seatCount = newSeatCount;
  // Note: Seat regeneration logic should be handled in controller
  
  zone.totalSeats = zone.rows.reduce((sum, r) => sum + r.seatCount, 0);
  this.updateTotals();
  return this;
};

// ==================== EXPORT ====================
module.exports = mongoose.model('Theater', theaterSchema);