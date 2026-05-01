const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const storeSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  storeName: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt
  },
  storeLogo: {
    type: String,
    default: null
  },
  description: {
    type: String,
    default: null,
    set: encrypt,
    get: decrypt
  },
  contactNumber: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt
  },
  address: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt
  },
  assignedTheater: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater',
    required: true
  },
  gstNumber: {
    type: String,
    default: null,
    set: encrypt,
    get: decrypt
  },
  fssaiLicense: {
    type: String,
    default: null,
    set: encrypt,
    get: decrypt
  },
  openingTime: {
    type: String,
    default: '10:00'
  },
  closingTime: {
    type: String,
    default: '22:00'
  },
  isOpen: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'PENDING'],
    default: 'PENDING'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { toJSON: { getters: true }, toObject: { getters: true } });

module.exports = mongoose.model('Store', storeSchema);