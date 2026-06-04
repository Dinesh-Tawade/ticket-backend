const Store = require('../../models/Store');
const Order = require('../../models/Order');

// Helper function to get status label
const getStatusLabel = (status) => {
  const labels = {
    'CONFIRMED': 'Confirmed',
    'PREPARING': 'Preparing',
    'READY': 'Ready for Delivery',
    'DELIVERED': 'Delivered',
    'CANCELLED': 'Cancelled'
  };
  return labels[status] || status;
};

// @desc    Get all orders for my store
// @route   GET /api/vendor/orders
const getMyStoreOrders = async (req, res) => {
  try {
    const store = await Store.findOne({ vendorId: req.user.id });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const { status, fromDate, toDate } = req.query;
    let filter = { storeId: store._id };
    
    if (status) filter.orderStatus = status;
    if (fromDate && toDate) {
      filter.orderedAt = { $gte: new Date(fromDate), $lte: new Date(toDate) };
    }

    const orders = await Order.find(filter)
      .populate('buyerId', 'name email phone')
      .populate('items.productId', 'name image')
      .sort({ orderedAt: -1 });

    const summary = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
      pendingOrders: orders.filter(o => o.orderStatus === 'PENDING').length,
      preparingOrders: orders.filter(o => o.orderStatus === 'PREPARING').length,
      readyOrders: orders.filter(o => o.orderStatus === 'READY').length,
      deliveredOrders: orders.filter(o => o.orderStatus === 'DELIVERED').length,
      cancelledOrders: orders.filter(o => o.orderStatus === 'CANCELLED').length
    };

    res.json({
      success: true,
      summary,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single order details
// @route   GET /api/vendor/order/:orderId
const getOrderDetails = async (req, res) => {
  try {
    const store = await Store.findOne({ vendorId: req.user.id });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const order = await Order.findOne({ orderId: req.params.orderId, storeId: store._id })
      .populate('buyerId', 'name email phone')
      .populate('items.productId', 'name image category');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status (with Socket.io real-time)
// @route   PUT /api/vendor/order/update-status/:orderId
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const store = await Store.findOne({ vendorId: req.user.id });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const order = await Order.findOne({ orderId: req.params.orderId, storeId: store._id })
      .populate('buyerId', 'name email phone');
      
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const validStatuses = ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    // Store old status for comparison
    const oldStatus = order.orderStatus;
    
    // Update order status
    order.orderStatus = status;
    
    if (status === 'CONFIRMED') order.confirmedAt = Date.now();
    if (status === 'PREPARING') order.preparedAt = Date.now();
    if (status === 'READY') order.readyAt = Date.now();
    if (status === 'DELIVERED') order.deliveredAt = Date.now();
    if (status === 'CANCELLED') order.cancelledAt = Date.now();

    await order.save();

    // 🔥 SEND REAL-TIME UPDATE VIA SOCKET.IO 🔥
    const io = req.app.get('io');
    if (io) {
      // Notify buyer about status change
      if (order.buyerId && order.buyerId._id) {
        io.to(`buyer_${order.buyerId._id}`).emit('order-status-updated', {
          orderId: order.orderId,
          status: order.orderStatus,
          statusLabel: getStatusLabel(status),
          oldStatus: oldStatus,
          updatedAt: new Date(),
          message: `Your order #${order.orderId} is now ${getStatusLabel(status)}`
        });
        console.log(`📢 Socket: Notified buyer ${order.buyerId._id} about order ${order.orderId} status: ${status}`);
      }

      // Notify vendor (self) for confirmation
      io.to(`vendor_${req.user.id}`).emit('order-status-changed', {
        orderId: order.orderId,
        status: order.orderStatus,
        statusLabel: getStatusLabel(status),
        updatedAt: new Date()
      });
    }

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateOrderStatusWithSocket = async (req, res) => {
  await updateOrderStatus(req, res);
};

// @desc    Get all orders in system (Admin)
// @route   GET /api/admin/orders
const getAllSystemOrders = async (req, res) => {
  try {
    const { status, fromDate, toDate, storeId } = req.query;
    let filter = {};
    
    if (status) filter.orderStatus = status;
    if (storeId) filter.storeId = storeId;
    if (fromDate && toDate) {
      filter.orderedAt = { $gte: new Date(fromDate), $lte: new Date(toDate) };
    }

    const orders = await Order.find(filter)
      .populate('buyerId', 'name email phone')
      .populate('storeId', 'storeName storeLogo')
      .populate('theaterId', 'name location')
      .sort({ orderedAt: -1 });

    const summary = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
      pendingOrders: orders.filter(o => o.orderStatus === 'PENDING').length,
      preparingOrders: orders.filter(o => o.orderStatus === 'PREPARING').length,
      readyOrders: orders.filter(o => o.orderStatus === 'READY').length,
      deliveredOrders: orders.filter(o => o.orderStatus === 'DELIVERED').length,
      cancelledOrders: orders.filter(o => o.orderStatus === 'CANCELLED').length
    };

    res.json({
      success: true,
      summary,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single order details in system (Admin)
// @route   GET /api/admin/order/:orderId
const getSystemOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate('buyerId', 'name email phone')
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

// @desc    Update order status in system (Admin)
// @route   PUT /api/admin/order/update-status/:orderId
const updateSystemOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate('buyerId', 'name email phone');
      
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const validStatuses = ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const oldStatus = order.orderStatus;
    order.orderStatus = status;
    
    if (status === 'CONFIRMED') order.confirmedAt = Date.now();
    if (status === 'PREPARING') order.preparedAt = Date.now();
    if (status === 'READY') order.readyAt = Date.now();
    if (status === 'DELIVERED') order.deliveredAt = Date.now();
    if (status === 'CANCELLED') order.cancelledAt = Date.now();

    await order.save();

    // Notify buyer about status change via socket if applicable
    const io = req.app.get('io');
    if (io) {
      if (order.buyerId && order.buyerId._id) {
        io.to(`buyer_${order.buyerId._id}`).emit('order-status-updated', {
          orderId: order.orderId,
          status: order.orderStatus,
          statusLabel: getStatusLabel(status),
          oldStatus: oldStatus,
          updatedAt: new Date(),
          message: `Your order #${order.orderId} is now ${getStatusLabel(status)}`
        });
      }
    }

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMyStoreOrders,
  getOrderDetails,
  updateOrderStatus,
  updateOrderStatusWithSocket,
  // Admin exports
  getAllSystemOrders,
  getSystemOrderDetails,
  updateSystemOrderStatus
};