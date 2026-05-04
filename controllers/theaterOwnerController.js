const Theater = require('../models/Theater');
const Show = require('../models/Show');
const Booking = require('../models/Booking');

// ==================== THEATER MANAGEMENT ====================

// @desc    Get all theaters of logged-in theater owner
// @route   GET /api/theater-owner/my-theaters
const getMyTheaters = async (req, res) => {
  try {
    const theaters = await Theater.find({ ownerId: req.user.id })
      .populate('createdBy', 'name email _id');
    
    res.json({
      success: true,
      count: theaters.length,
      data: theaters
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};




// @desc    Get single theater details by ID (only if owner)
// @route   GET /api/theater-owner/theater/:id
const getTheaterById = async (req, res) => {
  try {
    const theater = await Theater.findOne({
      _id: req.params.id,
      ownerId: req.user.id
    }).populate('createdBy', 'name email');

    if (!theater) {
      return res.status(404).json({ 
        success: false, 
        message: 'Theater not found or you are not the owner' 
      });
    }

    res.json({ success: true, data: theater });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update theater details
// @route   PUT /api/theater-owner/theater/update/:id
const updateTheater = async (req, res) => {
  try {
    const theater = await Theater.findOne({
      _id: req.params.id,
      ownerId: req.user.id
    });

    if (!theater) {
      return res.status(404).json({ 
        success: false, 
        message: 'Theater not found or you are not the owner' 
      });
    }

    const { name, location, city, state, pincode, contactNumber, images, status } = req.body;

    if (name) theater.name = name;
    if (location) theater.location = location;
    if (city) theater.city = city;
    if (state) theater.state = state;
    if (pincode) theater.pincode = pincode;
    if (contactNumber) theater.contactNumber = contactNumber;
    if (images) theater.images = images;
    if (status && ['ACTIVE', 'INACTIVE', 'PENDING'].includes(status)) {
      theater.status = status;
    }

    await theater.save();

    res.json({
      success: true,
      message: 'Theater updated successfully',
      data: theater
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete theater (only if no active shows)
// @route   DELETE /api/theater-owner/theater/delete/:id
const deleteTheater = async (req, res) => {
  try {
    const theater = await Theater.findOne({
      _id: req.params.id,
      ownerId: req.user.id
    });

    if (!theater) {
      return res.status(404).json({ 
        success: false, 
        message: 'Theater not found or you are not the owner' 
      });
    }

    // Check if there are any active or upcoming shows
    const activeShows = await Show.findOne({
      theaterId: req.params.id,
      status: { $in: ['BOOKING_OPEN', 'COMING_SOON'] }
    });

    if (activeShows) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete theater with active or upcoming shows' 
      });
    }

    await theater.deleteOne();

    res.json({
      success: true,
      message: 'Theater deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SCREEN MANAGEMENT ====================

// @desc    Get all screens of a theater
// @route   GET /api/theater-owner/theater/:theaterId/screens
const getScreens = async (req, res) => {
  try {
    const theater = await Theater.findOne({
      _id: req.params.theaterId,
      ownerId: req.user.id
    });

    if (!theater) {
      return res.status(404).json({ 
        success: false, 
        message: 'Theater not found or you are not the owner' 
      });
    }

    res.json({
      success: true,
      count: theater.screens.length,
      data: theater.screens
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single screen by ID
// @route   GET /api/theater-owner/theater/:theaterId/screen/:screenId
const getScreenById = async (req, res) => {
  try {
    const theater = await Theater.findOne({
      _id: req.params.theaterId,
      ownerId: req.user.id
    });

    if (!theater) {
      return res.status(404).json({ 
        success: false, 
        message: 'Theater not found or you are not the owner' 
      });
    }

    const screen = theater.screens.id(req.params.screenId);
    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
    }

    res.json({ success: true, data: screen });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add new screen to theater
// @route   POST /api/theater-owner/theater/:theaterId/add-screen
const addScreen = async (req, res) => {
  try {
    const theater = await Theater.findOne({
      _id: req.params.theaterId,
      ownerId: req.user.id
    });

    if (!theater) {
      return res.status(404).json({ 
        success: false, 
        message: 'Theater not found or you are not the owner' 
      });
    }

    const { screenNumber, name, totalRows, totalColumns, seatRows } = req.body;

    // Check if screen number already exists
    const screenExists = theater.screens.find(s => s.screenNumber === screenNumber);
    if (screenExists) {
      return res.status(400).json({ 
        success: false, 
        message: `Screen number ${screenNumber} already exists` 
      });
    }

    theater.screens.push({
      screenNumber,
      name,
      totalRows,
      totalColumns,
      seatRows: seatRows || [],
      status: 'ACTIVE'
    });

    await theater.save();
    
    const newScreen = theater.screens[theater.screens.length - 1];

    res.status(201).json({
      success: true,
      message: 'Screen added successfully',
      data: newScreen
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update screen details
// @route   PUT /api/theater-owner/theater/:theaterId/screen/:screenId
const updateScreen = async (req, res) => {
  try {
    const theater = await Theater.findOne({
      _id: req.params.theaterId,
      ownerId: req.user.id
    });

    if (!theater) {
      return res.status(404).json({ 
        success: false, 
        message: 'Theater not found or you are not the owner' 
      });
    }

    const screen = theater.screens.id(req.params.screenId);
    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
    }

    const { name, totalRows, totalColumns, seatRows, status } = req.body;

    if (name) screen.name = name;
    if (totalRows) screen.totalRows = totalRows;
    if (totalColumns) screen.totalColumns = totalColumns;
    if (seatRows) screen.seatRows = seatRows;
    if (status && ['ACTIVE', 'INACTIVE', 'MAINTENANCE'].includes(status)) {
      screen.status = status;
    }

    await theater.save();

    res.json({
      success: true,
      message: 'Screen updated successfully',
      data: screen
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete screen (only if no active shows on that screen)
// @route   DELETE /api/theater-owner/theater/:theaterId/screen/:screenId
const deleteScreen = async (req, res) => {
  try {
    const theater = await Theater.findOne({
      _id: req.params.theaterId,
      ownerId: req.user.id
    });

    if (!theater) {
      return res.status(404).json({ 
        success: false, 
        message: 'Theater not found or you are not the owner' 
      });
    }

    const screen = theater.screens.id(req.params.screenId);
    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
    }

    // Check if there are any active shows on this screen
    const activeShows = await Show.findOne({
      theaterId: req.params.theaterId,
      screenId: req.params.screenId,
      status: { $in: ['BOOKING_OPEN', 'COMING_SOON'] }
    });

    if (activeShows) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete screen with active or upcoming shows' 
      });
    }

    screen.deleteOne();
    await theater.save();

    res.json({
      success: true,
      message: 'Screen deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SHOW MANAGEMENT (Theater Owner) ====================

// @desc    Get all shows of my theaters
// @route   GET /api/theater-owner/my-shows
const getMyShows = async (req, res) => {
  try {
    // Get all theaters owned by this user
    const theaters = await Theater.find({ ownerId: req.user.id }).select('_id');
    const theaterIds = theaters.map(t => t._id);

    const shows = await Show.find({ theaterId: { $in: theaterIds } })
      .populate('theaterId', 'name location city')
      .sort({ showDate: 1, startTime: 1 });

    res.json({
      success: true,
      count: shows.length,
      data: shows
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get shows for a specific theater
// @route   GET /api/theater-owner/theater/:theaterId/shows
const getTheaterShows = async (req, res) => {
  try {
    const theater = await Theater.findOne({
      _id: req.params.theaterId,
      ownerId: req.user.id
    });

    if (!theater) {
      return res.status(404).json({ 
        success: false, 
        message: 'Theater not found or you are not the owner' 
      });
    }

    const shows = await Show.find({ theaterId: req.params.theaterId })
      .sort({ showDate: 1, startTime: 1 });

    res.json({
      success: true,
      count: shows.length,
      data: shows
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single show by ID (only if owner)
// @route   GET /api/theater-owner/show/:id
const getShowById = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id).populate('theaterId', 'name location');

    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    // Check if the logged-in user owns this theater
    const theater = await Theater.findOne({
      _id: show.theaterId,
      ownerId: req.user.id
    });

    if (!theater) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to view this show' 
      });
    }

    res.json({ success: true, data: show });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update show status (BOOKING_OPEN, CANCELLED, etc.)
// @route   PUT /api/theater-owner/show/update-status/:id
const updateShowStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const show = await Show.findById(req.params.id);

    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    // Check authorization
    const theater = await Theater.findOne({
      _id: show.theaterId,
      ownerId: req.user.id
    });

    if (!theater) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to update this show' 
      });
    }

    const validStatuses = ['COMING_SOON', 'BOOKING_OPEN', 'HOUSE_FULL', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    show.status = status;
    await show.save();

    res.json({
      success: true,
      message: `Show status updated to ${status}`,
      data: show
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== BOOKING REPORTS (Theater Owner) ====================

// @desc    Get all bookings for my theaters
// @route   GET /api/theater-owner/my-bookings
const getMyTheaterBookings = async (req, res) => {
  try {
    // Get all theaters owned by this user
    const theaters = await Theater.find({ ownerId: req.user.id }).select('_id');
    const theaterIds = theaters.map(t => t._id);

    const bookings = await Booking.find({ theaterId: { $in: theaterIds } })
      .populate('userId', 'name email phone')
      .populate('showId', 'movie.name showDate startTime')
      .sort({ bookedAt: -1 });

    // Calculate summary
    const summary = {
      totalBookings: bookings.length,
      totalRevenue: bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
      confirmedBookings: bookings.filter(b => b.bookingStatus === 'CONFIRMED').length,
      cancelledBookings: bookings.filter(b => b.bookingStatus === 'CANCELLED').length,
      totalSeatsBooked: bookings.reduce((sum, b) => sum + (b.totalSeats || 0), 0)
    };

    res.json({
      success: true,
      summary,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get bookings for a specific theater
// @route   GET /api/theater-owner/theater/:theaterId/bookings
const getTheaterBookings = async (req, res) => {
  try {
    const theater = await Theater.findOne({
      _id: req.params.theaterId,
      ownerId: req.user.id
    });

    if (!theater) {
      return res.status(404).json({ 
        success: false, 
        message: 'Theater not found or you are not the owner' 
      });
    }

    const bookings = await Booking.find({ theaterId: req.params.theaterId })
      .populate('userId', 'name email phone')
      .populate('showId', 'movie.name showDate startTime screenNumber')
      .sort({ bookedAt: -1 });

    const summary = {
      totalBookings: bookings.length,
      totalRevenue: bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
      confirmedBookings: bookings.filter(b => b.bookingStatus === 'CONFIRMED').length,
      totalSeatsBooked: bookings.reduce((sum, b) => sum + (b.totalSeats || 0), 0)
    };

    res.json({
      success: true,
      summary,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get dashboard stats for theater owner
// @route   GET /api/theater-owner/dashboard-stats
const getDashboardStats = async (req, res) => {
  try {
    const theaters = await Theater.find({ ownerId: req.user.id });
    const theaterIds = theaters.map(t => t._id);

    const totalTheaters = theaters.length;
    const totalScreens = theaters.reduce((sum, t) => sum + t.screens.length, 0);

    const totalShows = await Show.countDocuments({ theaterId: { $in: theaterIds } });
    const activeShows = await Show.countDocuments({ 
      theaterId: { $in: theaterIds }, 
      status: 'BOOKING_OPEN' 
    });
    const upcomingShows = await Show.countDocuments({ 
      theaterId: { $in: theaterIds }, 
      status: 'COMING_SOON' 
    });

    const bookings = await Booking.find({ theaterId: { $in: theaterIds } });
    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const totalSeatsBooked = bookings.reduce((sum, b) => sum + (b.totalSeats || 0), 0);

    res.json({
      success: true,
      data: {
        totalTheaters,
        totalScreens,
        totalShows,
        activeShows,
        upcomingShows,
        totalBookings,
        totalRevenue,
        totalSeatsBooked
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  // Theater Management
  getMyTheaters,
  getTheaterById,
  updateTheater,
  deleteTheater,
  // Screen Management
  getScreens,
  getScreenById,
  addScreen,
  updateScreen,
  deleteScreen,
  // Show Management
  getMyShows,
  getTheaterShows,
  getShowById,
  updateShowStatus,
  // Booking Reports
  getMyTheaterBookings,
  getTheaterBookings,
  getDashboardStats
};