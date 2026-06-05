const Show = require('../models/Show');
const Theater = require('../models/Theater');
const User = require('../models/User');

// Helper function to get current UTC time
const getCurrentUTC = () => {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    0
  ));
};

// Helper function to filter upcoming timings from a show
const filterUpcomingTimings = (show) => {
  const currentUTC = getCurrentUTC();
  const showObj = show.toObject();
  
  if (!showObj.timings || showObj.timings.length === 0) {
    return null;
  }
  
  // Filter only upcoming timings (with a 1-hour grace period)
  const upcomingTimings = showObj.timings.filter(timing => {
    const showDateUTC = new Date(timing.showDate);
    const [hours, minutes] = timing.startTime.split(':').map(Number);
    showDateUTC.setUTCHours(hours, minutes, 0, 0);
    
    // Expire 1 hour after show starts
    const expirationTime = new Date(showDateUTC.getTime() + 60 * 60 * 1000);
    return expirationTime > currentUTC;
  });
  
  if (upcomingTimings.length === 0) {
    return null;
  }
  
  // Update show with only upcoming timings
  showObj.timings = upcomingTimings;
  showObj.showDate = upcomingTimings[0].showDate;
  showObj.startTime = upcomingTimings[0].startTime;
  showObj.endTime = upcomingTimings[0].endTime;
  showObj.seatCategories = upcomingTimings[0].seatCategories;
  showObj.status = upcomingTimings[0].status;
  showObj.totalSeats = upcomingTimings[0].totalSeats;
  showObj.availableSeats = upcomingTimings[0].availableSeats;
  showObj.bookedSeatsCount = upcomingTimings[0].bookedSeatsCount;
  
  return showObj;
};

// @desc    Get all shows (Public) - Only upcoming shows
// @route   GET /api/public/shows
const getAllShows = async (req, res) => {
  try {
    const { city, movieName, date, genre, isTrending, language } = req.query;
    const currentUTC = getCurrentUTC();
    
    // Build filter - only show shows with upcoming timings
    let filter = {};
    
    // Only show shows that have at least one upcoming timing
    filter['timings'] = { $exists: true, $not: { $size: 0 } };
    
    if (city) {
      const theaters = await Theater.find({ city, status: 'ACTIVE' });
      filter.theaterId = { $in: theaters.map(t => t._id) };
    }
    if (movieName) filter['movie.name'] = { $regex: movieName, $options: 'i' };
    if (genre) filter['movie.genre'] = genre;
    if (isTrending === 'true') filter['movie.isTrending'] = true;
    if (language) filter['movie.language'] = language;
    
    // Date filter for upcoming shows
    if (date) {
      const targetDate = new Date(date);
      targetDate.setUTCHours(0, 0, 0, 0);
      const nextDate = new Date(targetDate);
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      
      filter['timings.showDate'] = { $gte: targetDate, $lt: nextDate };
    } else {
      // If no date specified, only show shows starting from today onwards
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      filter['timings.showDate'] = { $gte: todayStart };
    }
    
    let shows = await Show.find(filter)
      .populate('theaterId', 'name location city')
      .sort({ createdAt: -1 });
    
    // Filter each show's timings to only upcoming ones
    const upcomingShows = [];
    for (const show of shows) {
      const filteredShow = filterUpcomingTimings(show);
      if (filteredShow) {
        upcomingShows.push(filteredShow);
      }
    }
    
    // Sort by nearest show date-time
    upcomingShows.sort((a, b) => {
      const dateA = new Date(a.timings[0].showDate);
      const timeA = a.timings[0].startTime.split(':');
      dateA.setUTCHours(parseInt(timeA[0]), parseInt(timeA[1]));
      
      const dateB = new Date(b.timings[0].showDate);
      const timeB = b.timings[0].startTime.split(':');
      dateB.setUTCHours(parseInt(timeB[0]), parseInt(timeB[1]));
      
      return dateA - dateB;
    });
    
    res.json({ 
      success: true, 
      count: upcomingShows.length, 
      data: upcomingShows,
      serverTime: currentUTC
    });
  } catch (error) {
    console.error('Get all shows error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get trending shows - Only upcoming
// @route   GET /api/public/shows/trending
const getTrendingShows = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const shows = await Show.find({ 
      'movie.isTrending': true,
      'timings': { $exists: true, $not: { $size: 0 } },
      'timings.showDate': { $gte: todayStart }
    })
    .populate('theaterId', 'name location city')
    .limit(20);
    
    // Filter upcoming timings for each show
    const upcomingShows = [];
    for (const show of shows) {
      const filteredShow = filterUpcomingTimings(show);
      if (filteredShow) {
        upcomingShows.push(filteredShow);
      }
    }
    
    res.json({ 
      success: true, 
      count: upcomingShows.length, 
      data: upcomingShows,
      serverTime: currentUTC
    });
  } catch (error) {
    console.error('Get trending shows error:', error);
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

// @desc    Get show by ID (with seat layout) - Only if upcoming
// @route   GET /api/public/shows/:id
const getShowById = async (req, res) => {
  try {
    const currentUTC = getCurrentUTC();
    
    const show = await Show.findById(req.params.id)
      .populate('theaterId', 'name location city contactNumber screens');
    
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }
    
    // Check if show has any upcoming timing
    const filteredShow = filterUpcomingTimings(show);
    if (!filteredShow) {
      return res.status(404).json({ 
        success: false, 
        message: 'This show has expired and has no upcoming timings'
      });
    }

    // Get theater data for zone colors
    const theater = await Theater.findById(show.theaterId._id);
    
    // Find the screen in theater that matches show's screenId
    const screen = theater?.screens?.find(s => s._id.toString() === show.screenId.toString());
    
    // Get buyer's accessible seats if logged in
    const buyerAccess = req.user ? await getBuyerAccessibleSeats(req.user.id, show.theaterId._id, show.screenId) : null;
    
    // Prepare seat categories with proper formatting and access control
    const formattedSeatCategories = filteredShow.seatCategories?.map(category => {
      // Check if this zone is accessible to buyer
      const isZoneAccessible = buyerAccess ? (buyerAccess.zoneName === category.category) : true;
      
      return {
        category: category.category,
        pricePerSeat: category.pricePerSeat,
        totalSeats: category.totalSeats,
        availableSeats: category.availableSeats,
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
              seatLabel: seat.seatLabel || seat.seatNumber,
              isBooked: seat.isBooked,
              price: category.pricePerSeat,
              isAccessible: isSeatAccessible,
              canBook: !seat.isBooked && isSeatAccessible
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
      ...filteredShow,
      theaterId: theaterForClient || show.theaterId,
      seatCategories: formattedSeatCategories,
      theaterLayout: {
        screenPosition: theater?.screenPosition || "top",
        screenName: screen?.name,
        screenId: screen?._id,
        zones: screen?.zones || [],
        totalSeats: filteredShow.totalSeats,
        availableSeats: filteredShow.availableSeats
      },
      buyerAccessInfo: buyerAccess ? {
        hasAccess: true,
        zoneName: buyerAccess.zoneName,
        assignedSeatCount: buyerAccess.seatNumbers.length
      } : {
        hasAccess: false,
        message: req.user ? "No seats assigned to you for this theater" : "Login to see your assigned seats"
      },
      hasMultipleTimings: filteredShow.timings?.length > 1,
      totalTimings: filteredShow.timings?.length || 1,
      currentServerTime: currentUTC
    };

    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error("Error in getShowById:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get available seats for a show - Only if upcoming
// @route   GET /api/public/shows/:id/seats
const getAvailableSeats = async (req, res) => {
  try {
    const currentUTC = getCurrentUTC();
    
    const show = await Show.findById(req.params.id);
    
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }
    
    // Check if show has any upcoming timing
    const filteredShow = filterUpcomingTimings(show);
    if (!filteredShow) {
      return res.status(404).json({ 
        success: false, 
        message: 'This show has expired and has no upcoming timings'
      });
    }

    // Get theater data for zone colors
    const theater = await Theater.findById(show.theaterId);
    const screen = theater?.screens?.find(s => s._id.toString() === show.screenId.toString());
    
    // Get buyer's accessible seats if logged in
    const buyerAccess = req.user ? await getBuyerAccessibleSeats(req.user.id, show.theaterId, show.screenId) : null;
    
    // Prepare seat map with zone colors and access control
    const seatCategories = filteredShow.seatCategories?.map(category => {
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
              isAccessible: isSeatAccessible,
              canBook: !seat.isBooked && isSeatAccessible
            };
          })
        }))
      };
    }) || [];

    res.json({ 
      success: true, 
      data: { 
        seatCategories,
        totalSeats: filteredShow.totalSeats,
        availableSeats: filteredShow.availableSeats,
        screenPosition: theater?.screenPosition || "top",
        zones: screen?.zones || [],
        timingInfo: {
          showDate: filteredShow.showDate,
          startTime: filteredShow.startTime,
          endTime: filteredShow.endTime,
          hasMultipleTimings: filteredShow.timings?.length > 1,
          totalTimings: filteredShow.timings?.length || 1
        },
        buyerAccess: buyerAccess ? {
          hasAccess: true,
          zoneName: buyerAccess.zoneName,
          assignedSeatNumbers: buyerAccess.seatNumbers
        } : {
          hasAccess: false,
          message: req.user ? "No seats assigned" : "Login required"
        },
        serverTime: currentUTC
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
    console.error('Get all theaters error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get upcoming timings for a specific show
// @route   GET /api/public/shows/:id/timings
const getShowTimings = async (req, res) => {
  try {
    const currentUTC = getCurrentUTC();
    
    const show = await Show.findById(req.params.id);
    
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }
    
    if (!show.timings || show.timings.length === 0) {
      return res.status(404).json({ success: false, message: 'No timings found for this show' });
    }
    
    // Filter upcoming timings (with a 1-hour grace period)
    const upcomingTimings = show.timings.filter(timing => {
      const showDateUTC = new Date(timing.showDate);
      const [hours, minutes] = timing.startTime.split(':').map(Number);
      showDateUTC.setUTCHours(hours, minutes, 0, 0);
      
      // Expire 1 hour after show starts
      const expirationTime = new Date(showDateUTC.getTime() + 60 * 60 * 1000);
      return expirationTime > currentUTC;
    });
    
    if (upcomingTimings.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No upcoming timings for this show' 
      });
    }
    
    // Format timings for response
    const formattedTimings = upcomingTimings.map(timing => ({
      timingId: timing._id,
      showDate: timing.showDate,
      startTime: timing.startTime,
      endTime: timing.endTime,
      status: timing.status,
      availableSeats: timing.availableSeats,
      totalSeats: timing.totalSeats,
      bookedSeatsCount: timing.bookedSeatsCount,
      formattedDateTime: `${new Date(timing.showDate).toLocaleDateString()} at ${timing.startTime}`
    }));
    
    res.json({
      success: true,
      data: {
        showId: show._id,
        movieName: show.movie?.name,
        theaterId: show.theaterId,
        screenNumber: show.screenNumber,
        timings: formattedTimings,
        totalUpcomingTimings: formattedTimings.length
      },
      serverTime: currentUTC
    });
  } catch (error) {
    console.error('Get show timings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllShows,
  getTrendingShows,
  getShowById,
  getAllTheaters,
  getAvailableSeats,
  getShowTimings  // New endpoint
};