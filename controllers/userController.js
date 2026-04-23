const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// @desc    Buyer self-registration (Alias for auth register)
// @route   POST /api/users/register
const registerBuyer = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone, address } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Please add all fields" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Password and confirm password do not match" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const userData = {
      name,
      email,
      password,
      phone: phone || null,
      address: address || null,
      role: 'BUYER',
      status: 'ACTIVE'
    };

    if (req.file) {
      userData.profileImage = req.file.path.replace(/\\/g, '/');
    }

    const user = await User.create(userData);

    res.status(201).json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Buyer login
// @route   POST /api/users/login
const loginBuyer = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (user.role !== 'BUYER') {
      return res.status(403).json({ success: false, message: "This endpoint is only for buyers" });
    }

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    res.json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get buyer profile
// @route   GET /api/users/profile
const getBuyerProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    
    if (user.role !== 'BUYER') {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { registerBuyer, loginBuyer, getBuyerProfile };