const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: String,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  }
});

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  theaterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater'
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  },
  items: [orderItemSchema],
  subTotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  deliveryCharge: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
    default: 'PENDING'
  },
  orderStatus: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING'
  },
  paymentMethod: {
    type: String,
    enum: ['ONLINE', 'CASH', 'CARD', 'UPI'],
    default: 'ONLINE'
  },
  paymentId: {
    type: String,
    default: null
  },
  deliveryType: {
    type: String,
    enum: ['SEAT_DELIVERY', 'COUNTER_PICKUP'],
    default: 'SEAT_DELIVERY'
  },
  deliveryAddress: {
    type: String,
    default: null
  },
  specialInstructions: {
    type: String,
    default: null
  },
  orderedAt: {
    type: Date,
    default: Date.now
  },
  confirmedAt: Date,
  preparedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  cancelledReason: String
});

// Generate unique order ID
orderSchema.pre('save', async function(next) {
  if (!this.orderId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.orderId = `ORD${year}${month}${day}${random}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);