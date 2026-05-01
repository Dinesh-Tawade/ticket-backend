const Store = require('../../models/Store');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const PaymentTransaction = require('../../models/PaymentTransaction');
const Theater = require('../../models/Theater');
const Show = require('../../models/Show');

// Temporary cart storage (in production use Redis or Database)
let userCarts = {};

// ==================== CART MANAGEMENT ====================

// @desc    Add item to cart
// @route   POST /api/buyer/cart/add
const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.user.id;

    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Product ID and valid quantity required' });
    }

    // Get product details
    const product = await Product.findById(productId).populate('storeId');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (!product.isAvailable || product.stock < quantity) {
      return res.status(400).json({ success: false, message: 'Product out of stock' });
    }

    // Initialize cart for user if not exists
    if (!userCarts[userId]) {
      userCarts[userId] = {
        items: [],
        storeId: product.storeId._id,
        theaterId: product.storeId.assignedTheater,
        totalAmount: 0
      };
    }

    // Check if same store
    if (userCarts[userId].storeId.toString() !== product.storeId._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot add items from different stores. Please clear cart first.' 
      });
    }

    // Check if product already in cart
    const existingItem = userCarts[userId].items.find(item => item.productId === productId);
    
    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.total = existingItem.price * existingItem.quantity;
    } else {
      userCarts[userId].items.push({
        productId: product._id,
        productName: product.name,
        quantity: quantity,
        price: product.discountPrice || product.price,
        total: (product.discountPrice || product.price) * quantity,
        image: product.image
      });
    }

    // Update total amount
    userCarts[userId].totalAmount = userCarts[userId].items.reduce((sum, item) => sum + item.total, 0);

    res.json({
      success: true,
      message: 'Item added to cart',
      data: {
        cart: userCarts[userId],
        itemCount: userCarts[userId].items.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my cart
// @route   GET /api/buyer/cart
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = userCarts[userId] || { items: [], totalAmount: 0, storeId: null, theaterId: null };
    
    res.json({
      success: true,
      data: {
        items: cart.items || [],
        totalAmount: cart.totalAmount || 0,
        itemCount: cart.items ? cart.items.length : 0,
        storeId: cart.storeId,
        theaterId: cart.theaterId
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/buyer/cart/update/:productId
const updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;

    if (!userCarts[userId]) {
      return res.status(404).json({ success: false, message: 'Cart is empty' });
    }

    const itemIndex = userCarts[userId].items.findIndex(item => item.productId === productId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    if (quantity <= 0) {
      // Remove item
      userCarts[userId].items.splice(itemIndex, 1);
    } else {
      // Update quantity
      userCarts[userId].items[itemIndex].quantity = quantity;
      userCarts[userId].items[itemIndex].total = userCarts[userId].items[itemIndex].price * quantity;
    }

    // Update total amount
    userCarts[userId].totalAmount = userCarts[userId].items.reduce((sum, item) => sum + item.total, 0);

    // If cart empty, delete it
    if (userCarts[userId].items.length === 0) {
      delete userCarts[userId];
      return res.json({ success: true, message: 'Cart is now empty', data: { items: [], totalAmount: 0 } });
    }

    res.json({
      success: true,
      message: 'Cart updated',
      data: {
        items: userCarts[userId].items,
        totalAmount: userCarts[userId].totalAmount,
        itemCount: userCarts[userId].items.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/buyer/cart/remove/:productId
const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    if (!userCarts[userId]) {
      return res.status(404).json({ success: false, message: 'Cart is empty' });
    }

    userCarts[userId].items = userCarts[userId].items.filter(item => item.productId !== productId);
    userCarts[userId].totalAmount = userCarts[userId].items.reduce((sum, item) => sum + item.total, 0);

    if (userCarts[userId].items.length === 0) {
      delete userCarts[userId];
      return res.json({ success: true, message: 'Cart is now empty', data: { items: [], totalAmount: 0 } });
    }

    res.json({
      success: true,
      message: 'Item removed from cart',
      data: {
        items: userCarts[userId].items,
        totalAmount: userCarts[userId].totalAmount,
        itemCount: userCarts[userId].items.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear cart
// @route   DELETE /api/buyer/cart/clear
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    delete userCarts[userId];
    
    res.json({ success: true, message: 'Cart cleared successfully', data: { items: [], totalAmount: 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ORDER MANAGEMENT ====================

// @desc    Place order from cart
// @route   POST /api/buyer/order/place
const placeOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { deliveryType, specialInstructions, bookingId, paymentMethod } = req.body;

    const cart = userCarts[userId];
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Verify store exists and is open
    const store = await Store.findById(cart.storeId);
    if (!store || !store.isOpen) {
      return res.status(400).json({ success: false, message: 'Store is currently closed' });
    }

    // Verify product stock
    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({ 
          success: false, 
          message: `${product?.name || 'Product'} is out of stock` 
        });
      }
    }

    // Calculate tax (5% GST)
    const subTotal = cart.totalAmount;
    const tax = subTotal * 0.05;
    const deliveryCharge = deliveryType === 'SEAT_DELIVERY' ? 20 : 0;
    const totalAmount = subTotal + tax + deliveryCharge;

    // Create order
    const orderItems = cart.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      price: item.price,
      total: item.total
    }));

    // Update product stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity, salesCount: item.quantity }
      });
    }

    const order = await Order.create({
      buyerId: userId,
      storeId: cart.storeId,
      theaterId: cart.theaterId,
      bookingId: bookingId || null,
      items: orderItems,
      subTotal,
      tax,
      deliveryCharge,
      totalAmount,
      paymentStatus: paymentMethod === 'ONLINE' ? 'PENDING' : 'PENDING',
      orderStatus: 'PENDING',
      paymentMethod: paymentMethod || 'ONLINE',
      deliveryType: deliveryType || 'SEAT_DELIVERY',
      specialInstructions: specialInstructions || null,
      orderedAt: new Date()
    });

    // Clear cart
    delete userCarts[userId];

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        orderId: order.orderId,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        expiresAt: order.expiresAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my orders
// @route   GET /api/buyer/orders
const getMyOrders = async (req, res) => {
  try {
    const { status } = req.query;
    let filter = { buyerId: req.user.id };
    if (status) filter.orderStatus = status;

    const orders = await Order.find(filter)
      .populate('storeId', 'storeName storeLogo')
      .populate('theaterId', 'name location')
      .sort({ orderedAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single order details
// @route   GET /api/buyer/order/:orderId
const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId, buyerId: req.user.id })
      .populate('storeId', 'storeName storeLogo contactNumber')
      .populate('theaterId', 'name location city')
      .populate('items.productId', 'name image category');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Track order status
// @route   GET /api/buyer/order/track/:orderId
const trackOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId, buyerId: req.user.id })
      .select('orderId orderStatus paymentStatus estimatedDeliveryTime');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const statusFlow = {
      'PENDING': { step: 1, message: 'Order received' },
      'CONFIRMED': { step: 2, message: 'Order confirmed' },
      'PREPARING': { step: 3, message: 'Preparing your food' },
      'READY': { step: 4, message: 'Ready for delivery/pickup' },
      'DELIVERED': { step: 5, message: 'Delivered' },
      'CANCELLED': { step: -1, message: 'Order cancelled' }
    };

    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        status: order.orderStatus,
        statusInfo: statusFlow[order.orderStatus],
        paymentStatus: order.paymentStatus,
        estimatedDeliveryTime: order.estimatedDeliveryTime
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel order (before preparation)
// @route   PUT /api/buyer/order/cancel/:orderId
const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId, buyerId: req.user.id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Only allow cancellation if order is PENDING or CONFIRMED
    if (!['PENDING', 'CONFIRMED'].includes(order.orderStatus)) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot cancel order in ${order.orderStatus} status` 
      });
    }

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity, salesCount: -item.quantity }
      });
    }

    order.orderStatus = 'CANCELLED';
    order.cancelledAt = new Date();
    order.cancelledBy = 'USER';
    await order.save();

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== PAYMENT ====================

// @desc    Process payment for order
// @route   POST /api/buyer/order/pay/:orderId
const processPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod, paymentDetails } = req.body;

    const order = await Order.findOne({ orderId, buyerId: req.user.id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.paymentStatus === 'PAID') {
      return res.status(400).json({ success: false, message: 'Order already paid' });
    }

    // Simulate payment processing
    const transactionId = 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    // Update order payment status
    order.paymentStatus = 'PAID';
    order.paymentId = transactionId;
    await order.save();

    // Create payment transaction record
    await PaymentTransaction.create({
      orderId: order._id,
      storeId: order.storeId,
      amount: order.totalAmount,
      type: 'ORDER_PAYMENT',
      status: 'SUCCESS',
      paymentMethod: paymentMethod || 'ONLINE',
      transactionId: transactionId,
      gatewayResponse: paymentDetails || {}
    });

    res.json({
      success: true,
      message: 'Payment successful',
      data: {
        orderId: order.orderId,
        transactionId,
        amount: order.totalAmount,
        paymentStatus: order.paymentStatus
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== BROWSE PRODUCTS ====================

// @desc    Get products by theater
// @route   GET /api/buyer/theater/:theaterId/products
const getTheaterProducts = async (req, res) => {
  try {
    const { theaterId } = req.params;
    const { category } = req.query;

    // First try to find store by assignedTheater (Theater ID)
    let store = await Store.findOne({ assignedTheater: theaterId, isOpen: true });
    
    // If not found, try to find by theater owner (backward compatibility)
    if (!store) {
      // Find theater first
      const theater = await Theater.findById(theaterId);
      if (theater) {
        store = await Store.findOne({ assignedTheater: theater.ownerId, isOpen: true });
      }
    }

    if (!store) {
      return res.status(404).json({ 
        success: false, 
        message: 'No store found for this theater',
        debug: { theaterId }
      });
    }

    let filter = { storeId: store._id, isAvailable: true, stock: { $gt: 0 } };
    if (category) filter.category = category;

    const products = await Product.find(filter).sort({ createdAt: -1 });

    // Group by category
    const groupedProducts = products.reduce((acc, product) => {
      if (!acc[product.category]) acc[product.category] = [];
      acc[product.category].push(product);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        store: {
          id: store._id,
          name: store.storeName,
          logo: store.storeLogo,
          isOpen: store.isOpen
        },
        categories: Object.keys(groupedProducts),
        products: groupedProducts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get product categories
// @route   GET /api/buyer/categories
const getProductCategories = async (req, res) => {
  const categories = [
    { value: 'POPCORN', label: 'Popcorn', icon: '🍿' },
    { value: 'BEVERAGES', label: 'Beverages', icon: '🥤' },
    { value: 'COMBO', label: 'Combos', icon: '🍱' },
    { value: 'SNACKS', label: 'Snacks', icon: '🍪' },
    { value: 'ICE_CREAM', label: 'Ice Cream', icon: '🍦' },
    { value: 'CANDY', label: 'Candy', icon: '🍬' },
    { value: 'MEAL', label: 'Meals', icon: '🍔' }
  ];
  res.json({ success: true, data: categories });
};

module.exports = {
  // Cart
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  // Order
  placeOrder,
  getMyOrders,
  getOrderDetails,
  trackOrder,
  cancelOrder,
  // Payment
  processPayment,
  // Browse
  getTheaterProducts,
  getProductCategories
};