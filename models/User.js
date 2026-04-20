const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
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
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'BLOCKED'],
    default: 'PENDING'
  },
  phone: {
    type: String,
    default: null
  },
  address: {
    type: String,
    default: null
  },
  // Theater owner specific
  theaterName: {
    type: String,
    default: null
  },
  theaterLocation: {
    type: String,
    default: null
  },
  theaterImages: [String],
  // Vendor specific
  vendorType: {
    type: String,
    enum: ['FOOD', 'BEVERAGE', 'MERCHANDISE', null],
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
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