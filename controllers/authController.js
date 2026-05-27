const User = require('../models/User');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const deleteOldImage = (imagePath) => {
  if (imagePath && fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
};

// @desc    Register Buyer (Only BUYER can self-register)
// @route   POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone, address } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Please add all fields" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Password and confirm password do not match" });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    // Create user - ONLY BUYER ROLE
    const userData = {
      name,
      email,
      password,
      phone: phone || null,
      address: address || null,
      role: 'BUYER',
      status: 'ACTIVE'
    };

    // Add profile image if uploaded
    if (req.file) {
      userData.profileImage = req.file.path.replace(/\\/g, '/');
    }

    const user = await User.create(userData);

    res.status(201).json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
      status: user.status,
      profileImage: user.profileImage,
      assignedZone: user.assignedZone || null,
      assignedSeats: user.assignedSeats || [],
      message: "Registration successful!",
      token: generateToken(user._id)
    });
  } catch (error) {
    if (req.file) {
      deleteOldImage(req.file.path);
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Login user (Anyone - BUYER, THEATER_OWNER, VENDOR, SUPER_ADMIN)
// @route   POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Please add all fields" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ 
        success: false, 
        message: `Your account is ${user.status}. Please contact admin.` 
      });
    }

    res.json({
      success: true,
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
      status: user.status,
      profileImage: user.profileImage,
      assignedZone: user.assignedZone || null,
      assignedSeats: user.assignedSeats || [],
      ...(user.role === 'THEATER_OWNER' && { theaters: user.theaters }),
      ...(user.role === 'VENDOR' && { storeName: user.storeName, vendorType: user.vendorType, isOpen: user.isOpen }),
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const logOut = async (req, res) => {
  try {
    // Clear token on client side by sending a response
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("assignedTheater", "name email");
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update profile
// @route   PUT /api/auth/update-profile
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { name, phone, address } = req.body;
    
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    if (req.file) {
      if (user.profileImage && fs.existsSync(user.profileImage)) {
        deleteOldImage(user.profileImage);
      }
      user.profileImage = req.file.path.replace(/\\/g, '/');
    }

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: user
    });
  } catch (error) {
    if (req.file) {
      deleteOldImage(req.file.path);
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { register, login, getMe, updateProfile, logOut };