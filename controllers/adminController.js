const User = require('../models/User');
const fs = require('fs');

const getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({ 
      status: 'PENDING',
      role: { $ne: 'SUPER_ADMIN' }
    }).select('-password');
    
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.status = 'APPROVED';
    user.approvedBy = req.user.id;
    user.approvedAt = Date.now();
    await user.save();

    res.json({ success: true, message: `User ${user.name} approved successfully`, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const rejectUser = async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.status = 'REJECTED';
    user.rejectionReason = reason || 'No reason provided';
    await user.save();

    res.json({ success: true, message: `User ${user.name} rejected`, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { role, status } = req.query;
    let filter = {};
    
    if (role) filter.role = role;
    if (status) filter.status = status;
    
    const users = await User.find(filter).select('-password');
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createSuperAdmin = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const superAdmin = await User.create({
      name,
      email,
      password,
      phone,
      role: 'SUPER_ADMIN',
      status: 'APPROVED'
    });

    res.status(201).json({
      success: true,
      message: 'Super Admin created successfully',
      data: {
        _id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        role: superAdmin.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.role = role;
    await user.save();

    res.json({ success: true, message: `User role updated to ${role}`, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const blockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.status = user.status === 'BLOCKED' ? 'APPROVED' : 'BLOCKED';
    await user.save();

    res.json({ success: true, message: `User ${user.status === 'BLOCKED' ? 'blocked' : 'unblocked'}`, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserStats = async (req, res) => {
  try {
    const stats = {
      totalUsers: await User.countDocuments(),
      pendingUsers: await User.countDocuments({ status: 'PENDING' }),
      approvedUsers: await User.countDocuments({ status: 'APPROVED' }),
      blockedUsers: await User.countDocuments({ status: 'BLOCKED' }),
      superAdmins: await User.countDocuments({ role: 'SUPER_ADMIN' }),
      theaterOwners: await User.countDocuments({ role: 'THEATER_OWNER' }),
      vendors: await User.countDocuments({ role: 'VENDOR' }),
      buyers: await User.countDocuments({ role: 'BUYER' })
    };
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPendingUsers,
  approveUser,
  rejectUser,
  getAllUsers,
  createSuperAdmin,
  updateUserRole,
  blockUser,
  getUserStats
};