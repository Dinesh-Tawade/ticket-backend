const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const { register, login,  getMe, updateProfile } = require('../controllers/authController');
const { getPendingUsers, approveUser, rejectUser, getAllUsers, createSuperAdmin, updateUserRole, blockUser, getUserStats} = require('../controllers/adminController');
const router = express.Router();

// ==================== PUBLIC ROUTES ====================
router.post('/auth/register', uploadSingle('profileImage'), register);
router.post('/auth/login', login);

// ==================== PROTECTED ROUTES ====================
router.get('/auth/me', protect, getMe);
router.put('/auth/update-profile', protect, uploadSingle('profileImage'), updateProfile);

// ==================== ADMIN ROUTES (SUPER_ADMIN only) ====================
router.get('/admin/pending-users', protect, authorize('SUPER_ADMIN'), getPendingUsers);
router.get('/admin/users', protect, authorize('SUPER_ADMIN'), getAllUsers);
router.get('/admin/stats', protect, authorize('SUPER_ADMIN'), getUserStats);
router.put('/admin/approve/:id', protect, authorize('SUPER_ADMIN'), approveUser);
router.put('/admin/reject/:id', protect, authorize('SUPER_ADMIN'), rejectUser);
router.post('/admin/create-super-admin', protect, authorize('SUPER_ADMIN'), createSuperAdmin);
router.put('/admin/update-role/:id', protect, authorize('SUPER_ADMIN'), updateUserRole);
router.put('/admin/block/:id', protect, authorize('SUPER_ADMIN'), blockUser);

// ==================== SERVE STATIC FILES (Images) ====================
router.use('/uploads', express.static('uploads'));



module.exports = router;