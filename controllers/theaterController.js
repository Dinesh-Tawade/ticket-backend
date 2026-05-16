const Theater = require('../models/Theater');
const Show = require('../models/Show');
const Booking = require('../models/Booking');
const User = require('../models/User');

// ==================== THEATER MANAGEMENT ====================

// @desc    Create Theater
// @route   POST /api/admin/theater/create
const createTheater = async (req, res) => {
  try {
    const {
      ownerId, name, location, city, state, pincode, contactNumber,
      screens, images
    } = req.body;

    const owner = await User.findOne({ _id: ownerId, role: 'THEATER_OWNER' });
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Theater owner not found' });
    }

    const theater = await Theater.create({
      ownerId,
      name,
      location,
      city,
      state,
      pincode,
      contactNumber,
      screens: screens || [],
      images: images || [],
      createdBy: req.user.id,
      status: 'ACTIVE'
    });

    res.status(201).json({
      success: true,
      message: 'Theater created successfully',
      data: theater
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Theaters
// @route   GET /api/admin/theater/all
const getAllTheaters = async (req, res) => {
  try {
    const { city, status } = req.query;
    let filter = {};
    if (city) filter.city = city;
    if (status) filter.status = status;

    const theaters = await Theater.find(filter).populate('ownerId', 'name email');
    res.json({ success: true, count: theaters.length, data: theaters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Theater By ID
// @route   GET /api/admin/theater/:id
const getTheaterById = async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id).populate('ownerId', 'name email');
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }
    res.json({ success: true, data: theater });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Theater
// @route   PUT /api/admin/theater/update/:id
const updateTheater = async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const { name, location, city, state, pincode, contactNumber, status, screens } = req.body;

    if (name !== undefined) theater.name = name;
    if (location !== undefined) theater.location = location;
    if (city !== undefined) theater.city = city;
    if (state !== undefined) theater.state = state;
    if (pincode !== undefined) theater.pincode = pincode;
    if (contactNumber !== undefined) theater.contactNumber = contactNumber;
    if (status !== undefined) theater.status = status;
    if (screens !== undefined) theater.screens = screens;

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

// @desc    Add Screen to Theater
// @route   POST /api/admin/theater/add-screen/:id
const addScreenToTheater = async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const { screenNumber, name, totalRows, totalColumns, seatRows } = req.body;

    theater.screens.push({
      screenNumber,
      name,
      totalRows,
      totalColumns,
      seatRows: seatRows || [],
      status: 'ACTIVE'
    });

    await theater.save();
    res.json({ success: true, message: 'Screen added successfully', data: theater.screens });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Screen from Theater
// @route   DELETE /api/admin/theater/delete-screen/:id/:screenId
const deleteScreenFromTheater = async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const screen = theater.screens.id(req.params.screenId);
    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
    }

    theater.screens.pull({ _id: req.params.screenId });
    await theater.save();
    res.json({ success: true, message: 'Screen deleted successfully', data: theater.screens });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Theater
// @route   DELETE /api/admin/theater/delete/:id
const deleteTheater = async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const activeShows = await Show.findOne({ theaterId: req.params.id, status: { $in: ['BOOKING_OPEN', 'COMING_SOON'] } });
    if (activeShows) {
      return res.status(400).json({ success: false, message: 'Cannot delete theater with active shows' });
    }

    await theater.deleteOne();
    res.json({ success: true, message: 'Theater deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SHOW MANAGEMENT ====================

// @desc    Create Show
// @route   POST /api/admin/show/create
const createShow = async (req, res) => {
  try {
    const {
      theaterId, screenId, screenNumber, movie, showDate, startTime, endTime,
      seatCategories, isPaid, basePrice
    } = req.body;

    const theater = await Theater.findById(theaterId);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const screen = theater.screens.id(screenId);
    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
    }

    const generatedSeatCategories = [];
    
    for (const categoryConfig of seatCategories) {
      const categoryRows = screen.seatRows.filter(row => row.category === categoryConfig.category);
      const rows = [];
      
      for (const rowConfig of categoryRows) {
        const seats = [];
        for (let i = rowConfig.startSeat; i <= rowConfig.endSeat; i++) {
          seats.push({
            seatNumber: i,
            isBooked: false,
            bookedBy: null,
            bookingId: null
          });
        }
        rows.push({
          rowName: rowConfig.rowName,
          seats: seats
        });
      }
      
      generatedSeatCategories.push({
        category: categoryConfig.category,
        rows: rows,
        pricePerSeat: categoryConfig.pricePerSeat,
        totalSeats: rows.reduce((acc, row) => acc + row.seats.length, 0),
        availableSeats: rows.reduce((acc, row) => acc + row.seats.length, 0)
      });
    }

    const show = await Show.create({
      theaterId,
      screenId,
      screenNumber,
      movie,
      showDate: new Date(showDate),
      startTime,
      endTime,
      seatCategories: generatedSeatCategories,
      isPaid: isPaid || false,
      basePrice: basePrice || 0,
      status: 'BOOKING_OPEN',
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Show created successfully',
      data: show
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Shows (Admin)
// @route   GET /api/admin/show/all
const getAllShows = async (req, res) => {
  try {
    const { theaterId, status, fromDate, toDate } = req.query;
    let filter = {};
    
    if (theaterId) filter.theaterId = theaterId;
    if (status) filter.status = status;
    if (fromDate && toDate) {
      filter.showDate = { $gte: new Date(fromDate), $lte: new Date(toDate) };
    }

    const shows = await Show.find(filter).populate('theaterId', 'name location');
    res.json({ success: true, count: shows.length, data: shows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Detailed Show By ID
// @route   GET /api/admin/show/:id
const getDetailedShowById = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id)
      .populate('theaterId', 'name location')
      .populate('createdBy', 'name email');

    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    res.json({ success: true, data: show });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Show Details (NEW - for paid/free mode)
// @route   PUT /api/admin/show/update/:id
const updateShow = async (req, res) => {
  try {
    const { isPaid, basePrice, status, movie, showDate, startTime, endTime } = req.body;
    const show = await Show.findById(req.params.id);

    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    if (isPaid !== undefined) show.isPaid = isPaid;
    if (basePrice !== undefined) show.basePrice = basePrice;
    if (status !== undefined) show.status = status;
    if (movie !== undefined) show.movie = { ...show.movie.toObject ? show.movie.toObject() : show.movie, ...movie };
    if (showDate !== undefined) show.showDate = new Date(showDate);
    if (startTime !== undefined) show.startTime = startTime;
    if (endTime !== undefined) show.endTime = endTime;

    await show.save();

    res.json({ success: true, message: 'Show updated successfully', data: show });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Set all shows to free or paid (NEW - Bulk update)
// @route   PUT /api/admin/shows/set-paid-all
const setAllShowsPaymentMode = async (req, res) => {
  try {
    const { isPaid } = req.body;

    if (typeof isPaid !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isPaid must be true or false' });
    }

    const result = await Show.updateMany({}, { isPaid: isPaid });

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount || 0} shows to ${isPaid ? 'paid' : 'free'}`,
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Show Status
// @route   PUT /api/admin/show/update-status/:id
const updateShowStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const show = await Show.findById(req.params.id);
    
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    show.status = status;
    await show.save();

    res.json({ success: true, message: `Show status updated to ${status}`, data: show });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Show
// @route   DELETE /api/admin/show/delete/:id
const deleteShow = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id);
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    const bookings = await Booking.findOne({ showId: req.params.id, bookingStatus: 'CONFIRMED' });
    if (bookings) {
      return res.status(400).json({ success: false, message: 'Cannot delete show with confirmed bookings' });
    }

    await show.deleteOne();
    res.json({ success: true, message: 'Show deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== EXPORTS ====================
module.exports = {
  createTheater,
  getAllTheaters,
  getTheaterById,
  updateTheater,
  addScreenToTheater,
  deleteTheater,
  deleteScreenFromTheater,
  createShow,
  getAllShows,
  getDetailedShowById,
  updateShow,              // ✅ ADDED
  updateShowStatus,
  deleteShow,
  setAllShowsPaymentMode   // ✅ ADDED
};