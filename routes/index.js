const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

// Import controllers
const { 
  register, 
  login, 
  getMe, 
  updateProfile 
} = require('../controllers/authController');

const {
  getPendingUsers,
  approveUser,
  rejectUser,
  getAllUsers,
  createSuperAdmin,
  updateUserRole,
  blockUser,
  getUserStats
} = require('../controllers/adminController');

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

// ==================== TEST ROUTE ====================
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Booking App API is running...',
    version: '1.0.0',
    endpoints: {
      public: {
        register: 'POST /api/auth/register (with profileImage file)',
        login: 'POST /api/auth/login'
      },
      protected: {
        profile: 'GET /api/auth/me',
        updateProfile: 'PUT /api/auth/update-profile (with profileImage file)'
      },
      admin: {
        stats: 'GET /api/admin/stats',
        pendingUsers: 'GET /api/admin/pending-users',
        approveUser: 'PUT /api/admin/approve/:id',
        rejectUser: 'PUT /api/admin/reject/:id',
        allUsers: 'GET /api/admin/users',
        createSuperAdmin: 'POST /api/admin/create-super-admin',
        updateRole: 'PUT /api/admin/update-role/:id',
        blockUser: 'PUT /api/admin/block/:id'
      }
    }
  });
});

module.exports = router;