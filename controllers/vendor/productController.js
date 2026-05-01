const Store = require('../../models/Store');
const Product = require('../../models/Product');
const fs = require('fs');

const deleteOldImage = (imagePath) => {
  if (imagePath && fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
};

// @desc    Add product
// @route   POST /api/vendor/product/add
const addProduct = async (req, res) => {
  try {
    const store = await Store.findOne({ vendorId: req.user.id });
    if (!store) {
      if (req.file) deleteOldImage(req.file.path);
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const {
      name, description, category, price, discountPrice,
      stock, unit, isVegetarian, preparationTime
    } = req.body;

    let image = null;
    if (req.file) {
      image = req.file.path.replace(/\\/g, '/');
    }

    const product = await Product.create({
      storeId: store._id,
      name,
      description,
      category,
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      stock: parseInt(stock) || 0,
      unit: unit || 'PCS',
      image,
      isVegetarian: isVegetarian !== undefined ? isVegetarian : true,
      preparationTime: parseInt(preparationTime) || 5,
      isAvailable: (parseInt(stock) || 0) > 0
    });

    res.status(201).json({
      success: true,
      message: 'Product added successfully',
      data: product
    });
  } catch (error) {
    if (req.file) deleteOldImage(req.file.path);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all my products
// @route   GET /api/vendor/products
const getMyProducts = async (req, res) => {
  try {
    const store = await Store.findOne({ vendorId: req.user.id });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const products = await Product.find({ storeId: store._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single product
// @route   GET /api/vendor/product/:id
const getProductById = async (req, res) => {
  try {
    const store = await Store.findOne({ vendorId: req.user.id });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const product = await Product.findOne({ _id: req.params.id, storeId: store._id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/vendor/product/update/:id
const updateProduct = async (req, res) => {
  try {
    const store = await Store.findOne({ vendorId: req.user.id });
    if (!store) {
      if (req.file) deleteOldImage(req.file.path);
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const product = await Product.findOne({ _id: req.params.id, storeId: store._id });
    if (!product) {
      if (req.file) deleteOldImage(req.file.path);
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const {
      name, description, category, price, discountPrice,
      stock, unit, isVegetarian, preparationTime, isAvailable
    } = req.body;

    if (name) product.name = name;
    if (description) product.description = description;
    if (category) product.category = category;
    if (price) product.price = parseFloat(price);
    if (discountPrice !== undefined) product.discountPrice = discountPrice ? parseFloat(discountPrice) : null;
    if (stock !== undefined) product.stock = parseInt(stock);
    if (unit) product.unit = unit;
    if (isVegetarian !== undefined) product.isVegetarian = isVegetarian;
    if (preparationTime) product.preparationTime = parseInt(preparationTime);
    if (isAvailable !== undefined) product.isAvailable = isAvailable;

    if (req.file) {
      if (product.image) deleteOldImage(product.image);
      product.image = req.file.path.replace(/\\/g, '/');
    }

    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    if (req.file) deleteOldImage(req.file.path);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update product stock
// @route   PUT /api/vendor/product/update-stock/:id
const updateProductStock = async (req, res) => {
  try {
    const { stock } = req.body;
    const store = await Store.findOne({ vendorId: req.user.id });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const product = await Product.findOne({ _id: req.params.id, storeId: store._id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.stock = parseInt(stock);
    product.isAvailable = parseInt(stock) > 0;
    await product.save();

    res.json({
      success: true,
      message: 'Stock updated successfully',
      data: { stock: product.stock, isAvailable: product.isAvailable }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/vendor/product/delete/:id
const deleteProduct = async (req, res) => {
  try {
    const store = await Store.findOne({ vendorId: req.user.id });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const product = await Product.findOne({ _id: req.params.id, storeId: store._id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.image) deleteOldImage(product.image);
    await product.deleteOne();

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  addProduct,
  getMyProducts,
  getProductById,
  updateProduct,
  updateProductStock,
  deleteProduct
};