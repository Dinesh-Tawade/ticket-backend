const Store = require('../../models/Store');
const PaymentTransaction = require('../../models/PaymentTransaction');
const Order = require('../../models/Order');

// @desc    Get payment transactions
// @route   GET /api/vendor/payments
const getPaymentTransactions = async (req, res) => {
  try {
    const store = await Store.findOne({ vendorId: req.user.id });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const transactions = await PaymentTransaction.find({ storeId: store._id })
      .populate('orderId', 'orderId totalAmount')
      .sort({ createdAt: -1 });

    // Fetch delivered orders to calculate counts and total payment
    const deliveredOrders = await Order.find({
      storeId: store._id,
      orderStatus: 'DELIVERED'
    });

    const summary = {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
      successfulTransactions: transactions.filter(t => t.status === 'SUCCESS').length,
      pendingTransactions: transactions.filter(t => t.status === 'PENDING').length,
      deliveredOrdersCount: deliveredOrders.length,
      deliveredOrdersTotalPayment: deliveredOrders.reduce((sum, o) => sum + o.totalAmount, 0)
    };

    res.json({
      success: true,
      summary,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPaymentTransactions
};