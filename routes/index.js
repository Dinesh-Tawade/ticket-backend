const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

// Auth Controllers
const { register, login, getMe, updateProfile } = require('../controllers/authController');

// User Controllers
const { registerBuyer, loginBuyer, getBuyerProfile } = require('../controllers/userController');

// Admin Controllers - Sab imports sahi se check karo
const {
  createTheaterOwner,
  createVendor,
  createBuyer,
  createSuperAdmin,
  getAllUsers,
  getUserById,
  getUserStats,
  updateUser,
  updateUserStatus,
  addTheaterToOwner,
  deleteUser
} = require('../controllers/adminController');

const router = express.Router();

// ==================== TEST ROUTE ====================
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Booking App API', version: '1.0.0' });
});

// ==================== PUBLIC ROUTES ====================
router.post('/auth/register', uploadSingle('profileImage'), register);
router.post('/auth/login', login);
router.post('/users/register', uploadSingle('profileImage'), registerBuyer);
router.post('/users/login', loginBuyer);

// ==================== PROTECTED ROUTES ====================
router.get('/auth/me', protect, getMe);
router.put('/auth/update-profile', protect, uploadSingle('profileImage'), updateProfile);
router.get('/users/profile', protect, getBuyerProfile);

// ==================== ADMIN ROUTES ====================
router.post('/admin/create-theater-owner', protect, authorize('SUPER_ADMIN'), createTheaterOwner);
router.post('/admin/create-vendor', protect, authorize('SUPER_ADMIN'), createVendor);
router.post('/admin/create-buyer', protect, authorize('SUPER_ADMIN'), createBuyer);
router.post('/admin/staff', protect, authorize('SUPER_ADMIN'), createSuperAdmin);

router.get('/admin/users', protect, authorize('SUPER_ADMIN'), getAllUsers);
router.get('/admin/users/:id', protect, authorize('SUPER_ADMIN'), getUserById);
router.get('/admin/stats', protect, authorize('SUPER_ADMIN'), getUserStats);

router.put('/admin/users/:id', protect, authorize('SUPER_ADMIN'), updateUser);
router.put('/admin/update-status/:id', protect, authorize('SUPER_ADMIN'), updateUserStatus);
router.post('/admin/add-theater/:theaterOwnerId', protect, authorize('SUPER_ADMIN'), addTheaterToOwner);

router.delete('/admin/users/:id', protect, authorize('SUPER_ADMIN'), deleteUser);

// ==================== SETUP ROUTE ====================
router.post('/setup/create-super-admin', async (req, res) => {
  try {
    const User = require('../models/User');
    const { name, email, password, phone, address } = req.body;
    
    const existingAdmin = await User.findOne({ role: 'SUPER_ADMIN' });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Super Admin already exists!' });
    }
    
    const superAdmin = await User.create({
      name: name || 'Super Admin',
      email: email || 'superadmin@bookingapp.com',
      password: password || 'SuperAdmin123!',
      phone: phone || '9999999999',
      address: address || 'Admin Office',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE'
    });
    
    res.status(201).json({
      success: true,
      message: 'Super Admin created successfully!',
      data: { _id: superAdmin._id, name: superAdmin.name, email: superAdmin.email, role: superAdmin.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.use('/uploads', express.static('uploads'));

module.exports = router;