const User = require('../models/User');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Helper to delete old image
const deleteOldImage = (imagePath) => {
  if (imagePath && fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
};

// @desc    Register user
// @route   POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, phone, address, role, theaterName, theaterLocation, vendorType } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    let status = 'APPROVED';
    if (role === 'THEATER_OWNER' || role === 'VENDOR') {
      status = 'PENDING';
    }

    const userData = {
      name,
      email,
      password,
      phone,
      address,
      role: role || 'BUYER',
      status
    };

    // Add profile image if uploaded
    if (req.file) {
      userData.profileImage = req.file.path.replace(/\\/g, '/');
    }

    if (role === 'THEATER_OWNER') {
      userData.theaterName = theaterName;
      userData.theaterLocation = theaterLocation;
    }

    if (role === 'VENDOR') {
      userData.vendorType = vendorType;
    }

    const user = await User.create(userData);

    res.status(201).json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      profileImage: user.profileImage,
      message: status === 'PENDING' 
        ? 'Registration successful! Waiting for admin approval.' 
        : 'Registration successful!',
      token: generateToken(user._id)
    });
  } catch (error) {
    // Delete uploaded file if error occurs
    if (req.file) {
      deleteOldImage(req.file.path);
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status !== 'APPROVED') {
      return res.status(403).json({ 
        success: false,
        message: `Your account is ${user.status}. Please wait for admin approval.` 
      });
    }

    res.json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      profileImage: user.profileImage,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update profile with image
// @route   PUT /api/auth/update-profile
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update fields
    const { name, phone, address } = req.body;
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    // Update profile image if uploaded
    if (req.file) {
      // Delete old image if exists
      if (user.profileImage && fs.existsSync(user.profileImage)) {
        deleteOldImage(user.profileImage);
      }
      user.profileImage = req.file.path.replace(/\\/g, '/');
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        profileImage: user.profileImage,
        role: user.role
      }
    });
  } catch (error) {
    if (req.file) {
      deleteOldImage(req.file.path);
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { register, login, getMe, updateProfile };