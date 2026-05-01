const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const productSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  name: {
    type: String,
    required: true,
    set: encrypt,
    get: decrypt
  },
  description: {
    type: String,
    default: null,
    set: encrypt,
    get: decrypt
  },
  category: {
    type: String,
    enum: ['POPCORN', 'BEVERAGES', 'COMBO', 'SNACKS', 'ICE_CREAM', 'CANDY', 'MEAL', 'OTHER'],
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  discountPrice: {
    type: Number,
    default: null
  },
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  unit: {
    type: String,
    enum: ['PCS', 'KG', 'LTR', 'BOX', 'PACKET', 'BOTTLE', 'CUP'],
    default: 'PCS'
  },
  image: {
    type: String,
    default: null
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isVegetarian: {
    type: Boolean,
    default: true
  },
  preparationTime: {
    type: Number, // in minutes
    default: 5
  },
  salesCount: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Product', productSchema);