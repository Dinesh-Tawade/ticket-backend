const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const seatRowSchema = new mongoose.Schema({
  rowName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['NORMAL', 'EXECUTIVE', 'PREMIUM', 'VIP', 'COUPLE'],
    required: true
  },
  startSeat: {
    type: Number,
    required: true
  },
  endSeat: {
    type: Number,
    required: true
  },
  priceMultiplier: {
    type: Number,
    default: 1.0
  }
});

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
  totalRows: {
    type: Number,
    required: true
  },
  totalColumns: {
    type: Number,
    required: true
  },
  seatRows: [seatRowSchema],
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'],
    default: 'ACTIVE'
  }
}, { toJSON: { getters: true }, toObject: { getters: true } });

const theaterSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt
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
    get: decrypt
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
  screens: [screenSchema],
  images: [String],
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'PENDING'],
    default: 'PENDING'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { toJSON: { getters: true }, toObject: { getters: true } });

module.exports = mongoose.model('Theater', theaterSchema);