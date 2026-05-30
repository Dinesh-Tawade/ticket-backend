const Show = require('../models/Show');
const Theater = require('../models/Theater');
const User = require('../models/User');

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

// Helper function to get buyer's accessible seats
const getBuyerAccessibleSeats = async (userId, theaterId, screenId) => {
  if (!userId) return null;
  
  try {
    const user = await User.findById(userId);
    if (!user || user.role !== 'BUYER') return null;
    
    // Find access for this theater
    const access = user.accessibleSeats?.find(
      a => a.theaterId?.toString() === theaterId?.toString() && a.isActive === true
    );
    
    if (!access) return null;
    
    // Check expiry
    if (access.validUntil && new Date() > new Date(access.validUntil)) return null;
    
    return {
      zoneId: access.zoneId,
      zoneName: access.zoneName,
      seatNumbers: access.seatNumbers || []
    };
  } catch (error) {
    console.error("Error getting buyer accessible seats:", error);
    return null;
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
    
    // Get buyer's accessible seats if logged in
    const buyerAccess = req.user ? await getBuyerAccessibleSeats(req.user.id, show.theaterId._id, show.screenId) : null;
    
    // Prepare seat categories with proper formatting and access control
    const formattedSeatCategories = show.seatCategories?.map(category => {
      // Check if this zone is accessible to buyer
      const isZoneAccessible = buyerAccess ? (buyerAccess.zoneName === category.category) : true;
      
      return {
        category: category.category,
        pricePerSeat: category.pricePerSeat,
        totalSeats: category.totalSeats,
        availableSeats: category.availableSeats,
        isAccessible: isZoneAccessible,  // ✅ Zone-level access flag
        rows: category.rows?.map(row => ({
          rowName: row.rowName,
          seats: row.seats?.map(seat => {
            // Check if this specific seat is accessible to buyer
            const isSeatAccessible = buyerAccess 
              ? (buyerAccess.seatNumbers.includes(seat.seatNumber) && isZoneAccessible)
              : true;
            
            return {
              seatNumber: seat.seatNumber,
              seatLabel: seat.seatLabel || seat.seatNumber,
              isBooked: seat.isBooked,
              price: category.pricePerSeat,
              isAccessible: isSeatAccessible,      // ✅ Seat-level access flag
              canBook: !seat.isBooked && isSeatAccessible  // ✅ Can book if not booked AND accessible
            };
          })
        }))
      };
    }) || [];

    // Full theater on theaterId (screens + aisles for 2D seat map)
    const theaterForClient = show.theaterId
      ? {
          ...show.theaterId.toObject(),
          screens: theater?.screens || show.theaterId.screens || [],
          layoutMeta: theater?.layoutMeta || {},
          screenPosition: theater?.screenPosition || 'top',
        }
      : null;

    // Prepare response with complete seat layout
    const responseData = {
      ...show.toObject(),
      theaterId: theaterForClient || show.theaterId,
      seatCategories: formattedSeatCategories,
      theaterLayout: {
        screenPosition: theater?.screenPosition || "top",
        screenName: screen?.name,
        screenId: screen?._id,
        zones: screen?.zones || [],
        totalSeats: show.totalSeats,
        availableSeats: show.availableSeats
      },
      buyerAccessInfo: buyerAccess ? {
        hasAccess: true,
        zoneName: buyerAccess.zoneName,
        assignedSeatCount: buyerAccess.seatNumbers.length
      } : {
        hasAccess: false,
        message: req.user ? "No seats assigned to you for this theater" : "Login to see your assigned seats"
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
    
    // Get buyer's accessible seats if logged in
    const buyerAccess = req.user ? await getBuyerAccessibleSeats(req.user.id, show.theaterId, show.screenId) : null;
    
    // Prepare seat map with zone colors and access control
    const seatCategories = show.seatCategories?.map(category => {
      // Check if this zone is accessible to buyer
      const isZoneAccessible = buyerAccess ? (buyerAccess.zoneName === category.category) : true;
      
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
        isAccessible: isZoneAccessible,
        rows: category.rows?.map(row => ({
          rowName: row.rowName,
          seats: row.seats?.map(seat => {
            // Check if this specific seat is accessible to buyer
            const isSeatAccessible = buyerAccess 
              ? (buyerAccess.seatNumbers.includes(seat.seatNumber) && isZoneAccessible)
              : true;
            
            return {
              seatNumber: seat.seatNumber,
              isBooked: seat.isBooked,
              price: category.pricePerSeat,
              seatLabel: seat.seatLabel || seat.seatNumber,
              isAccessible: isSeatAccessible,      // ✅ Frontend will show as disabled if false
              canBook: !seat.isBooked && isSeatAccessible  // ✅ Booking possible only if true
            };
          })
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
        zones: screen?.zones || [],
        buyerAccess: buyerAccess ? {
          hasAccess: true,
          zoneName: buyerAccess.zoneName,
          assignedSeatNumbers: buyerAccess.seatNumbers
        } : {
          hasAccess: false,
          message: req.user ? "No seats assigned" : "Login required"
        }
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
  getAvailableSeats
};