const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

// Auth Controllers
const { register, login, getMe, updateProfile } = require('../controllers/authController');

// User Controllers
const { registerBuyer, loginBuyer, getBuyerProfile } = require('../controllers/userController');

// Admin Controllers
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

// Theater Controllers (Admin)
const {
  createTheater,
  getAllTheaters: adminGetAllTheaters,
  getTheaterById: adminGetTheaterById,
  updateTheater: adminUpdateTheater,
  addScreenToTheater,
  deleteTheater: adminDeleteTheater,
  deleteScreenFromTheater,
  createShow,
  getAllShows: adminGetAllShows,
  updateShowStatus: adminUpdateShowStatus,
  deleteShow: adminDeleteShow,
  getDetailedShowById
} = require('../controllers/theaterController');

// Booking Controllers
const {
  getAvailableSeats,
  createBooking,
  confirmPayment,
  getMyBookings,
  cancelBooking,
  getAllBookings
} = require('../controllers/bookingController');

// Public Controllers
const {
  getAllShows: publicGetAllShows,
  getTrendingShows,
  getShowById: publicGetShowById,
  getAllTheaters: publicGetAllTheaters
} = require('../controllers/publicController');

// Theater Owner Controllers
const {
  getMyTheaters,
  getTheaterById: ownerGetTheaterById,
  updateTheater: ownerUpdateTheater,
  deleteTheater: ownerDeleteTheater,
  getScreens,
  getScreenById,
  addScreen,
  updateScreen,
  deleteScreen,
  getMyShows,
  getTheaterShows,
  getShowById: ownerGetShowById,
  updateShowStatus: ownerUpdateShowStatus,
  getMyTheaterBookings,
  getTheaterBookings,
  getDashboardStats
} = require('../controllers/theaterOwnerController');

const router = express.Router();

// ==================== TEST ROUTE ====================
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Booking App API', version: '2.0.0' });
});

// ==================== PUBLIC ROUTES ====================
router.post('/auth/register', uploadSingle('profileImage'), register);
router.post('/auth/login', login);
router.post('/users/register', uploadSingle('profileImage'), registerBuyer);
router.post('/users/login', loginBuyer);

// Public Show Routes (No Auth)
router.get('/public/shows', publicGetAllShows);
router.get('/public/shows/trending', getTrendingShows);
router.get('/public/shows/:id', publicGetShowById);
router.get('/public/theaters', publicGetAllTheaters);
router.get('/public/shows/:id/seats', getAvailableSeats);

// ==================== PROTECTED ROUTES (All Authenticated Users) ====================
router.get('/auth/me', protect, getMe);
router.put('/auth/update-profile', protect, uploadSingle('profileImage'), updateProfile);
router.get('/users/profile', protect, getBuyerProfile);

// Booking Routes (Authenticated Users)
router.post('/public/booking/create', protect, createBooking);
router.put('/public/booking/confirm-payment/:bookingId', protect, confirmPayment);
router.get('/public/booking/my-bookings', protect, getMyBookings);
router.put('/public/booking/cancel/:bookingId', protect, cancelBooking);

// ==================== ADMIN ROUTES (SUPER_ADMIN only) ====================
// User Management
router.post('/admin/create-theater-owner', protect, authorize('SUPER_ADMIN'), createTheaterOwner);
router.post('/admin/create-vendor', protect, authorize('SUPER_ADMIN'), createVendor);
router.post('/admin/create-buyer', protect, authorize('SUPER_ADMIN'), createBuyer);
router.post('/admin/create-super-admin', protect, authorize('SUPER_ADMIN'), createSuperAdmin);
router.get('/admin/users', protect, authorize('SUPER_ADMIN'), getAllUsers);
router.get('/admin/users/:id', protect, authorize('SUPER_ADMIN'), getUserById);
router.get('/admin/stats', protect, authorize('SUPER_ADMIN'), getUserStats);
router.put('/admin/users/:id', protect, authorize('SUPER_ADMIN'), updateUser);
router.put('/admin/update-status/:id', protect, authorize('SUPER_ADMIN'), updateUserStatus);
router.post('/admin/add-theater/:theaterOwnerId', protect, authorize('SUPER_ADMIN'), addTheaterToOwner);
router.delete('/admin/users/:id', protect, authorize('SUPER_ADMIN'), deleteUser);

// Theater Management (Admin)
router.post('/admin/theater/create', protect, authorize('SUPER_ADMIN'), createTheater);
router.get('/admin/theater/all', protect, authorize('SUPER_ADMIN'), adminGetAllTheaters);
router.get('/admin/theater/:id', protect, authorize('SUPER_ADMIN'), adminGetTheaterById);
router.put('/admin/theater/update/:id', protect, authorize('SUPER_ADMIN'), adminUpdateTheater);
router.post('/admin/theater/add-screen/:id', protect, authorize('SUPER_ADMIN'), addScreenToTheater);
router.delete('/admin/theater/delete/:id', protect, authorize('SUPER_ADMIN'), adminDeleteTheater);
router.delete('/admin/theater/delete-screen/:id/:screenId', protect, authorize('SUPER_ADMIN'), deleteScreenFromTheater);

// Show Management (Admin)
router.post('/admin/show/create', protect, authorize('SUPER_ADMIN'), createShow);
router.get('/admin/show/all', protect, authorize('SUPER_ADMIN'), adminGetAllShows);
router.get('/admin/show/:id', protect, authorize('SUPER_ADMIN'), getDetailedShowById);
router.put('/admin/show/update-status/:id', protect, authorize('SUPER_ADMIN'), adminUpdateShowStatus);
router.delete('/admin/show/delete/:id', protect, authorize('SUPER_ADMIN'), adminDeleteShow);

// Booking Management (Admin)
router.get('/admin/booking/all', protect, authorize('SUPER_ADMIN'), getAllBookings);

// ==================== THEATER OWNER ROUTES ====================
// Dashboard
router.get('/theater-owner/dashboard-stats', protect, authorize('THEATER_OWNER'), getDashboardStats);

// Theater Management
router.get('/theater-owner/my-theaters', protect, authorize('THEATER_OWNER'), getMyTheaters);
router.get('/theater-owner/theater/:id', protect, authorize('THEATER_OWNER'), ownerGetTheaterById);
router.put('/theater-owner/theater/update/:id', protect, authorize('THEATER_OWNER'), ownerUpdateTheater);
router.delete('/theater-owner/theater/delete/:id', protect, authorize('THEATER_OWNER'), ownerDeleteTheater);

// Screen Management
router.get('/theater-owner/theater/:theaterId/screens', protect, authorize('THEATER_OWNER'), getScreens);
router.get('/theater-owner/theater/:theaterId/screen/:screenId', protect, authorize('THEATER_OWNER'), getScreenById);
router.post('/theater-owner/theater/:theaterId/add-screen', protect, authorize('THEATER_OWNER'), addScreen);
router.put('/theater-owner/theater/:theaterId/screen/:screenId', protect, authorize('THEATER_OWNER'), updateScreen);
router.delete('/theater-owner/theater/:theaterId/screen/:screenId', protect, authorize('THEATER_OWNER'), deleteScreen);

// Show Management
router.get('/theater-owner/my-shows', protect, authorize('THEATER_OWNER'), getMyShows);
router.get('/theater-owner/theater/:theaterId/shows', protect, authorize('THEATER_OWNER'), getTheaterShows);
router.get('/theater-owner/show/:id', protect, authorize('THEATER_OWNER'), ownerGetShowById);
router.put('/theater-owner/show/update-status/:id', protect, authorize('THEATER_OWNER'), ownerUpdateShowStatus);

// Booking Reports
router.get('/theater-owner/my-bookings', protect, authorize('THEATER_OWNER'), getMyTheaterBookings);
router.get('/theater-owner/theater/:theaterId/bookings', protect, authorize('THEATER_OWNER'), getTheaterBookings);

// ==================== SETUP ROUTE (First Time Only) ====================
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

// ==================== STATIC FILES ====================
router.use('/uploads', express.static('uploads'));

module.exports = router;