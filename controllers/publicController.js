const Show = require('../models/Show');
const Theater = require('../models/Theater');

// @desc    Get all shows (Public)
// @route   GET /api/public/shows
const getAllShows = async (req, res) => {
  try {
    const { city, movieName, date, genre, isTrending, language } = req.query;
    let filter = { status: 'BOOKING_OPEN' };
    
    if (city) {
      const theaters = await Theater.find({ city });
      filter.theaterId = { $in: theaters.map(t => t._id) };
    }
    if (movieName) filter['movie.name'] = { $regex: movieName, $options: 'i' };
    if (date) filter.showDate = { $gte: new Date(date), $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)) };
    if (genre) filter['movie.genre'] = genre;
    if (isTrending === 'true') filter['movie.isTrending'] = true;
    if (language) filter['movie.language'] = language;

    const shows = await Show.find(filter)
      .populate('theaterId', 'name location city')
      .sort({ showDate: 1, startTime: 1 });

    res.json({ success: true, count: shows.length, data: shows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get trending shows
// @route   GET /api/public/shows/trending
const getTrendingShows = async (req, res) => {
  try {
    const shows = await Show.find({ 
      'movie.isTrending': true, 
      status: 'BOOKING_OPEN' 
    })
    .populate('theaterId', 'name location city')
    .limit(10);

    res.json({ success: true, count: shows.length, data: shows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get show by ID (with seat layout)
// @route   GET /api/public/shows/:id
const getShowById = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id)
      .populate('theaterId', 'name location city contactNumber screens');
    
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    // Get theater data for zone colors
    const theater = await Theater.findById(show.theaterId._id);
    
    // Find the screen in theater that matches show's screenId
    const screen = theater?.screens?.find(s => s._id.toString() === show.screenId.toString());
    
    // Prepare seat categories with proper formatting
    const formattedSeatCategories = show.seatCategories?.map(category => ({
      category: category.category,
      pricePerSeat: category.pricePerSeat,
      totalSeats: category.totalSeats,
      availableSeats: category.availableSeats,
      rows: category.rows?.map(row => ({
        rowName: row.rowName,
        seats: row.seats?.map(seat => ({
          seatNumber: seat.seatNumber,
          seatLabel: seat.seatLabel || seat.seatNumber,
          isBooked: seat.isBooked,
          price: category.pricePerSeat
        }))
      }))
    })) || [];

    // Prepare response with complete seat layout
    const responseData = {
      ...show.toObject(),
      seatCategories: formattedSeatCategories,
      theaterLayout: {
        screenPosition: theater?.screenPosition || "top",
        screenName: screen?.name,
        screenId: screen?._id,
        zones: screen?.zones || [],
        totalSeats: show.totalSeats,
        availableSeats: show.availableSeats
      }
    };

    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error("Error in getShowById:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get available seats for a show
// @route   GET /api/public/shows/:id/seats
const getAvailableSeats = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id);
    
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    // Get theater data for zone colors
    const theater = await Theater.findById(show.theaterId);
    const screen = theater?.screens?.find(s => s._id.toString() === show.screenId.toString());
    
    // Prepare seat map with zone colors
    const seatCategories = show.seatCategories?.map(category => {
      // Get zone color for this category
      const zone = screen?.zones?.find(z => z.seatType === category.category);
      const zoneColor = zone?.color || 
        (category.category === 'NORMAL' ? '#3b82f6' : 
         category.category === 'EXECUTIVE' ? '#10b981' :
         category.category === 'PREMIUM' ? '#8b5cf6' : '#f59e0b');
      
      return {
        category: category.category,
        pricePerSeat: category.pricePerSeat,
        color: zoneColor,
        rows: category.rows?.map(row => ({
          rowName: row.rowName,
          seats: row.seats?.map(seat => ({
            seatNumber: seat.seatNumber,
            isBooked: seat.isBooked,
            price: category.pricePerSeat,
            seatLabel: seat.seatLabel || seat.seatNumber
          }))
        }))
      };
    }) || [];

    res.json({ 
      success: true, 
      data: { 
        seatCategories,
        totalSeats: show.totalSeats,
        availableSeats: show.availableSeats,
        screenPosition: theater?.screenPosition || "top",
        zones: screen?.zones || []
      } 
    });
  } catch (error) {
    console.error("Error in getAvailableSeats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all theaters (Public)
// @route   GET /api/public/theaters
const getAllTheaters = async (req, res) => {
  try {
    const { city } = req.query;
    let filter = { status: 'ACTIVE' };
    if (city) filter.city = city;

    const theaters = await Theater.find(filter).populate('ownerId', 'name email');
    res.json({ success: true, count: theaters.length, data: theaters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllShows,
  getTrendingShows,
  getShowById,
  getAllTheaters,
  getAvailableSeats  // ✅ Add this export
};