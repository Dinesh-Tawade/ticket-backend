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
    enum: [
      // South Asian / Indian Snacks
      'SAMOSA',
      'PAKORA',
      'VADA_PAV',
      'PAV_BHAJI',
      'PANI_PURI',
      'BHEL_PURI',
      'SEV_PURI',
      'DHOKLA',
      'KACHORI',
      'CHAT',
      'CHAAT',
      'BHAJI',
      'TEA',
      'COFFEE',
      'SOFT_DRINKS',
      'JUICES',
      'LASSI',
      'MASALA_CHAI',
      'BADAM_MILK',
      'THANDAL',
      'BIRYANI',
      'PULAO',
      'THALI',
      'MEAL_BOX',
      'PARATHA',
      'NAAN',
      'ROTI',
      'KATHI_ROLL',
      'WRAP',
      'DOSA',
      'IDLI',
      'VADA',
      'UTTAPAM',
      'BURGER',
      'PIZZA',
      'FRANCHIE',
      'SANDWICH',
      'TOAST',
      'GRILL_SANDWICH',
      'WRAP',
      'NOODLES',
      'MANCHURIAN',
      'CHILLI_POTATO',
      'GULAB_JAMUN',
      'JALEBI',
      'RASGULLA',
      'KHEER',
      'HALWA',
      'ICE_CREAM',
      'KULFI',
      'MALAI_CHOP',
      'MOTICHUR_LADOO',
      'RAJ_BHOG',
      'BALUSHAHI',
      'IMARTI',
      'COMBO',
      'FAMILY_PACK',
      'PARTY_ORDER',
      'BUCKET',
      'BOX_MEAL',
      'OTHER'
    ],
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  discountPrice: {
    type: Number,
    default: null,
    min: 0
  },
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  unit: {
    type: String,
    enum: [
      'PCS',      
      'PLATE',   
      'BOWL',    
      'CUP',     
      'GLASS',    
      'BOTTLE',  
      'PACKET',   
      'BOX',    
      'BUCKET',   
      'KG',     
      'GRAM',   
      'LTR',      
      'ML',      
      'DOZEN',    
      'HALF_DOZEN',
      'PAIR',
      'COMBO'
    ],
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
  isJain: {
    type: Boolean,
    default: false
  },
  spiceLevel: {
    type: String,
    enum: ['MILD', 'MEDIUM', 'HOT', 'EXTRA_HOT', 'NO_SPICE'],
    default: 'MEDIUM'
  },
  preparationTime: {
    type: Number,
    default: 10,
    min: 0
  },
  salesCount: {
    type: Number,
    default: 0,
    min: 0
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  ingredients: {
    type: String,
    default: null,
    set: encrypt,
    get: decrypt
  },
  nutritionalInfo: {
    calories: { type: Number, default: null },
    protein: { type: String, default: null },
    carbs: { type: String, default: null },
    fat: { type: String, default: null }
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isRecommended: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Update timestamps on save
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Update timestamps on findOneAndUpdate
productSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

// Virtual for discounted price
productSchema.virtual('finalPrice').get(function() {
  return this.discountPrice && this.discountPrice < this.price ? this.discountPrice : this.price;
});

// Virtual for discount percentage
productSchema.virtual('discountPercent').get(function() {
  if (this.discountPrice && this.discountPrice < this.price) {
    return Math.round(((this.price - this.discountPrice) / this.price) * 100);
  }
  return 0;
});

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
  if (this.stock === 0) return 'OUT_OF_STOCK';
  if (this.stock < 20) return 'LOW_STOCK';
  return 'IN_STOCK';
});

// Virtual for GST (India specific - 5% for food)
productSchema.virtual('gstAmount').get(function() {
  const gstRate = 0.05; // 5% GST for food items
  return this.finalPrice * gstRate;
});

// Virtual for total price with GST
productSchema.virtual('priceWithGST').get(function() {
  return this.finalPrice + this.gstAmount;
});

module.exports = mongoose.model('Product', productSchema);