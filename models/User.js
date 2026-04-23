const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// Encryption helper functions
const encrypt = (text) => {
  if (!text) return null;
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
};

const decrypt = (ciphertext) => {
  if (!ciphertext) return null;
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

const userSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: [true, 'Name is required'],
    set: encrypt,
    get: decrypt
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  profileImage: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'THEATER_OWNER', 'VENDOR', 'BUYER'],
    default: 'BUYER'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
    default: 'ACTIVE'
  },
  phone: {
    type: String,
    default: null,
    set: encrypt,
    get: decrypt
  },
  address: {
    type: String,
    default: null,
    set: encrypt,
    get: decrypt
  },

  // ==================== THEATER OWNER SPECIFIC FIELDS ====================
  theaters: [{
    theaterName: {
      type: String,
      set: encrypt,
      get: decrypt
    },
    theaterLocation: {
      type: String,
      set: encrypt,
      get: decrypt
    },
    city: {
      type: String,
      set: encrypt,
      get: decrypt
    },
    state: {
      type: String,
      set: encrypt,
      get: decrypt
    },
    pincode: {
      type: String,
      set: encrypt,
      get: decrypt
    },
    totalScreens: {
      type: Number,
      default: 1
    },
    contactNumber: {
      type: String,
      set: encrypt,
      get: decrypt
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // ==================== VENDOR SPECIFIC FIELDS ====================
  vendorType: {
    type: String,
    enum: ['FOOD', 'BEVERAGE', 'MERCHANDISE', null],
    default: null
  },
  assignedTheater: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  storeName: {
    type: String,
    default: null,
    set: encrypt,
    get: decrypt
  },
  storeLocation: {
    type: String,
    default: null,
    set: encrypt,
    get: decrypt
  },
  gstNumber: {
    type: String,
    default: null,
    set: encrypt,
    get: decrypt
  },
  foodLicenseNumber: {
    type: String,
    default: null,
    set: encrypt,
    get: decrypt
  },
  deliveryTime: {
    type: Number,
    default: 15
  },
  isOpen: {
    type: Boolean,
    default: true
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);