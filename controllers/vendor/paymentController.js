const Store = require('../../models/Store');
const PaymentTransaction = require('../../models/PaymentTransaction');

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

    const summary = {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
      successfulTransactions: transactions.filter(t => t.status === 'SUCCESS').length,
      pendingTransactions: transactions.filter(t => t.status === 'PENDING').length
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