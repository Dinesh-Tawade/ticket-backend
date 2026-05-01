const Store = require('../../models/Store');
const Order = require('../../models/Order');

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

// @desc    Update order status
// @route   PUT /api/vendor/order/update-status/:orderId
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const store = await Store.findOne({ vendorId: req.user.id });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const order = await Order.findOne({ orderId: req.params.orderId, storeId: store._id });
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

    order.orderStatus = status;
    
    if (status === 'CONFIRMED') order.confirmedAt = Date.now();
    if (status === 'PREPARING') order.preparedAt = Date.now();
    if (status === 'DELIVERED') order.deliveredAt = Date.now();
    if (status === 'CANCELLED') order.cancelledAt = Date.now();

    await order.save();

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
  updateOrderStatus
};