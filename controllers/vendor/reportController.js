const Store = require('../../models/Store');
const Order = require('../../models/Order');
const Product = require('../../models/Product');

// @desc    Get sales report
// @route   GET /api/vendor/sales-report
const getSalesReport = async (req, res) => {
  try {
    const store = await Store.findOne({ vendorId: req.user.id });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const { period, fromDate, toDate } = req.query;
    let startDate, endDate = new Date();

    if (period === 'today') {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === 'year') {
      startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else if (fromDate && toDate) {
      startDate = new Date(fromDate);
      endDate = new Date(toDate);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }

    const orders = await Order.find({
      storeId: store._id,
      orderStatus: 'DELIVERED',
      orderedAt: { $gte: startDate, $lte: endDate }
    });

    const dailySales = {};
    orders.forEach(order => {
      const date = order.orderedAt.toISOString().split('T')[0];
      if (!dailySales[date]) {
        dailySales[date] = { date, orders: 0, revenue: 0, items: 0 };
      }
      dailySales[date].orders++;
      dailySales[date].revenue += order.totalAmount;
      dailySales[date].items += order.items.reduce((sum, i) => sum + i.quantity, 0);
    });

    const productSales = {};
    for (const order of orders) {
      for (const item of order.items) {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            productId: item.productId,
            productName: item.productName,
            quantitySold: 0,
            revenue: 0
          };
        }
        productSales[item.productId].quantitySold += item.quantity;
        productSales[item.productId].revenue += item.total;
      }
    }

    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = orders.length;
    const totalItems = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    res.json({
      success: true,
      data: {
        period: { from: startDate, to: endDate },
        summary: { totalRevenue, totalOrders, totalItems, averageOrderValue },
        dailySales: Object.values(dailySales),
        topProducts: Object.values(productSales).sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 10)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/vendor/dashboard-stats
const getVendorDashboardStats = async (req, res) => {
  try {
    const store = await Store.findOne({ vendorId: req.user.id });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalProducts, lowStockProducts, todayOrders, pendingOrders, totalRevenue, todayRevenue] = await Promise.all([
      Product.countDocuments({ storeId: store._id }),
      Product.countDocuments({ storeId: store._id, stock: { $lt: 10 }, stock: { $gt: 0 } }),
      Order.countDocuments({ storeId: store._id, orderedAt: { $gte: today, $lt: tomorrow } }),
      Order.countDocuments({ storeId: store._id, orderStatus: { $in: ['PENDING', 'CONFIRMED', 'PREPARING'] } }),
      Order.aggregate([{ $match: { storeId: store._id, orderStatus: 'DELIVERED' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Order.aggregate([{ $match: { storeId: store._id, orderedAt: { $gte: today, $lt: tomorrow }, orderStatus: 'DELIVERED' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }])
    ]);

    res.json({
      success: true,
      data: {
        store: { name: store.storeName, isOpen: store.isOpen, status: store.status },
        products: { total: totalProducts, lowStock: lowStockProducts },
        orders: { today: todayOrders, pending: pendingOrders },
        revenue: { total: totalRevenue[0]?.total || 0, today: todayRevenue[0]?.total || 0 }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSalesReport,
  getVendorDashboardStats
};