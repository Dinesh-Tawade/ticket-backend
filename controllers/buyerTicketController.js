// controllers/buyerTicketController.js

const Show = require('../models/Show');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Theater = require('../models/Theater');

// ==================== BUYER SHOW VIEWING (Only shows with assigned seats) ====================

// @desc    Get all shows where buyer has assigned seats
// @route   GET /api/buyer/shows
const getBuyerShows = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get buyer's accessible seats data
    const user = await User.findById(userId).select('accessibleSeats');
    
    if (!user?.accessibleSeats || user.accessibleSeats.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: [],
        message: 'No seats assigned to you yet'
      });
    }
    
    // Get all theater IDs where user has assigned seats
    const theaterIds = user.accessibleSeats.map(seat => seat.theaterId?.toString()).filter(Boolean);
    
    if (theaterIds.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: [],
        message: 'No theaters assigned'
      });
    }
    
    // Find shows in those theaters that are available for booking
    const shows = await Show.find({
      theaterId: { $in: theaterIds },
      status: 'BOOKING_OPEN',
      showDate: { $gte: new Date() }
    })
    .populate('theaterId', 'name location city address')
    .sort({ showDate: 1, startTime: 1 });
    
    // Add accessible seat info to each show
    const showsWithAccess = shows.map(show => {
      const theaterAccess = user.accessibleSeats.find(
        seat => seat.theaterId?.toString() === show.theaterId?._id?.toString()
      );
      
      // Count available accessible seats for this show
      let availableAccessibleSeats = 0;
      const accessibleSeatNumbers = theaterAccess?.seatNumbers || [];
      
      // Check each timing
      if (show.timings && show.timings.length > 0) {
        for (const timing of show.timings) {
          const seatCategories = timing.seatCategories || show.seatCategories;
          for (const category of seatCategories) {
            for (const row of category.rows) {
              for (const seat of row.seats) {
                if (accessibleSeatNumbers.includes(seat.seatNumber) && !seat.isBooked) {
                  availableAccessibleSeats++;
                }
              }
            }
          }
        }
      } else {
        for (const category of show.seatCategories) {
          for (const row of category.rows) {
            for (const seat of row.seats) {
              if (accessibleSeatNumbers.includes(seat.seatNumber) && !seat.isBooked) {
                availableAccessibleSeats++;
              }
            }
          }
        }
      }
      
      return {
        ...show.toObject(),
        accessibleSeatCount: availableAccessibleSeats,
        accessibleSeatNumbers: accessibleSeatNumbers,
        hasAccessibleSeats: availableAccessibleSeats > 0
      };
    });
    
    // Filter shows that have at least one accessible seat available
    const accessibleShows = showsWithAccess.filter(show => show.hasAccessibleSeats);
    
    res.json({
      success: true,
      count: accessibleShows.length,
      data: accessibleShows
    });
  } catch (error) {
    console.error('Error in getBuyerShows:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get shows by theater for buyer (only if has assigned seats)
// @route   GET /api/buyer/shows/theater/:theaterId
const getBuyerShowsByTheater = async (req, res) => {
  try {
    const userId = req.user.id;
    const { theaterId } = req.params;
    
    // Get buyer's accessible seats
    const user = await User.findById(userId).select('accessibleSeats');
    
    if (!user?.accessibleSeats) {
      return res.json({
        success: true,
        count: 0,
        data: [],
        message: 'No seats assigned'
      });
    }
    
    // Check if buyer has access to this theater
    const theaterAccess = user.accessibleSeats.find(
      seat => seat.theaterId?.toString() === theaterId
    );
    
    if (!theaterAccess || !theaterAccess.seatNumbers || theaterAccess.seatNumbers.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: [],
        message: 'You don\'t have access to any seats in this theater'
      });
    }
    
    // Get shows in this theater
    const shows = await Show.find({
      theaterId: theaterId,
      status: 'BOOKING_OPEN',
      showDate: { $gte: new Date() }
    })
    .populate('theaterId', 'name location city address')
    .sort({ showDate: 1, startTime: 1 });
    
    // Add accessible seat info
    const showsWithAccess = shows.map(show => {
      let availableAccessibleSeats = 0;
      const accessibleSeatNumbers = theaterAccess.seatNumbers;
      
      if (show.timings && show.timings.length > 0) {
        for (const timing of show.timings) {
          const seatCategories = timing.seatCategories || show.seatCategories;
          for (const category of seatCategories) {
            for (const row of category.rows) {
              for (const seat of row.seats) {
                if (accessibleSeatNumbers.includes(seat.seatNumber) && !seat.isBooked) {
                  availableAccessibleSeats++;
                }
              }
            }
          }
        }
      } else {
        for (const category of show.seatCategories) {
          for (const row of category.rows) {
            for (const seat of row.seats) {
              if (accessibleSeatNumbers.includes(seat.seatNumber) && !seat.isBooked) {
                availableAccessibleSeats++;
              }
            }
          }
        }
      }
      
      return {
        ...show.toObject(),
        accessibleSeatCount: availableAccessibleSeats,
        accessibleSeatNumbers: accessibleSeatNumbers,
        hasAccessibleSeats: availableAccessibleSeats > 0
      };
    });
    
    const accessibleShows = showsWithAccess.filter(show => show.hasAccessibleSeats);
    
    res.json({
      success: true,
      count: accessibleShows.length,
      data: accessibleShows
    });
  } catch (error) {
    console.error('Error in getBuyerShowsByTheater:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get available seats for a show (only assigned seats)
// @route   GET /api/buyer/shows/:showId/seats
const getBuyerShowSeats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { showId } = req.params;
    
    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }
    
    // Get buyer's accessible seats
    const user = await User.findById(userId).select('accessibleSeats');
    
    if (!user?.accessibleSeats) {
      return res.json({
        success: true,
        data: {
          showId: show._id,
          movieName: show.movie.name,
          showDate: show.showDate,
          startTime: show.startTime,
          accessibleSeats: [],
          seatMap: {}
        }
      });
    }
    
    // Get accessible seats for this theater
    const theaterAccess = user.accessibleSeats.find(
      seat => seat.theaterId?.toString() === show.theaterId?.toString()
    );
    
    const accessibleSeatNumbers = theaterAccess?.seatNumbers || [];
    
    // Build seat map with only accessible seats
    const seatMap = {};
    
    // Handle multiple timings
    const currentTiming = show.timings?.[0] || show;
    const seatCategories = currentTiming.seatCategories || show.seatCategories;
    
    seatCategories.forEach(category => {
      seatMap[category.category] = {};
      category.rows.forEach(row => {
        seatMap[category.category][row.rowName] = row.seats
          .filter(seat => accessibleSeatNumbers.includes(seat.seatNumber))
          .map(seat => ({
            seatNumber: seat.seatNumber,
            isBooked: seat.isBooked,
            price: show.isPaid ? category.pricePerSeat : 0,
            isAccessible: true
          }));
      });
    });
    
    res.json({
      success: true,
      data: {
        showId: show._id,
        movieName: show.movie.name,
        showDate: show.showDate,
        startTime: show.startTime,
        endTime: show.endTime,
        screenNumber: show.screenNumber,
        accessibleSeats: accessibleSeatNumbers,
        seatMap,
        totalAccessibleSeats: accessibleSeatNumbers.length,
        availableAccessibleSeats: accessibleSeatNumbers.length // This should be calculated
      }
    });
  } catch (error) {
    console.error('Error in getBuyerShowSeats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Book tickets (only assigned seats)
// @route   POST /api/buyer/booking/create
const createBuyerBooking = async (req, res) => {
  try {
    const { showId, seats, timingId } = req.body;
    const userId = req.user.id;
    
    if (!seats || seats.length === 0) {
      return res.status(400).json({ success: false, message: 'No seats selected' });
    }
    
    if (seats.length > 40) {
      return res.status(400).json({ success: false, message: 'Maximum 40 seats per booking' });
    }
    
    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }
    
    // Get current timing
    let currentTiming = show;
    if (show.timings && show.timings.length > 0 && timingId) {
      currentTiming = show.timings.find(t => t._id.toString() === timingId);
      if (!currentTiming) {
        return res.status(404).json({ success: false, message: 'Timing not found' });
      }
    }
    
    // Check show status
    const showStatus = currentTiming.status || show.status;
    if (showStatus !== 'BOOKING_OPEN') {
      return res.status(400).json({ success: false, message: `Show is ${showStatus}. Cannot book tickets` });
    }
    
    // Get buyer's accessible seats
    const user = await User.findById(userId).select('accessibleSeats');
    
    if (!user?.accessibleSeats) {
      return res.status(403).json({ success: false, message: 'You don\'t have any assigned seats' });
    }
    
    // Get accessible seats for this theater
    const theaterAccess = user.accessibleSeats.find(
      seat => seat.theaterId?.toString() === show.theaterId?.toString()
    );
    
    const accessibleSeatNumbers = theaterAccess?.seatNumbers || [];
    
    if (accessibleSeatNumbers.length === 0) {
      return res.status(403).json({ success: false, message: 'You don\'t have access to any seats in this theater' });
    }
    
    // Validate that all selected seats are accessible
    for (const selectedSeat of seats) {
      const seatKey = `${selectedSeat.rowName}${selectedSeat.seatNumber}`;
      if (!accessibleSeatNumbers.includes(seatKey)) {
        return res.status(403).json({
          success: false,
          message: `Seat ${seatKey} is not assigned to you. You can only book: ${accessibleSeatNumbers.join(', ')}`
        });
      }
    }
    
    let totalAmount = 0;
    const bookedSeats = [];
    let seatCategories = currentTiming.seatCategories || show.seatCategories;
    seatCategories = JSON.parse(JSON.stringify(seatCategories));
    
    // Book each seat
    for (const selectedSeat of seats) {
      let seatFound = false;
      
      for (const category of seatCategories) {
        for (const row of category.rows) {
          if (row.rowName === selectedSeat.rowName) {
            const seat = row.seats.find(s => s.seatNumber === selectedSeat.seatNumber);
            if (seat && !seat.isBooked) {
              seat.isBooked = true;
              seat.bookedBy = userId;
              seat.bookingId = null;
              seatFound = true;
              const seatPrice = show.isPaid ? category.pricePerSeat : 0;
              totalAmount += seatPrice;
              bookedSeats.push({
                rowName: selectedSeat.rowName,
                seatNumber: selectedSeat.seatNumber,
                category: category.category,
                price: seatPrice
              });
              break;
            } else if (seat && seat.isBooked) {
              return res.status(400).json({
                success: false,
                message: `Seat ${selectedSeat.rowName}${selectedSeat.seatNumber} is already booked`
              });
            }
          }
        }
        if (seatFound) break;
      }
      
      if (!seatFound) {
        return res.status(404).json({
          success: false,
          message: `Seat ${selectedSeat.rowName}${selectedSeat.seatNumber} not found`
        });
      }
    }
    
    // Update show
    if (currentTiming !== show) {
      const timingIndex = show.timings.findIndex(t => t._id.toString() === timingId);
      show.timings[timingIndex].seatCategories = seatCategories;
      show.timings[timingIndex].bookedSeatsCount = (show.timings[timingIndex].bookedSeatsCount || 0) + seats.length;
      show.timings[timingIndex].availableSeats = show.timings[timingIndex].totalSeats - show.timings[timingIndex].bookedSeatsCount;
    } else {
      show.seatCategories = seatCategories;
      show.bookedSeatsCount = (show.bookedSeatsCount || 0) + seats.length;
      show.availableSeats = show.totalSeats - show.bookedSeatsCount;
    }
    
    await show.save();
    
    // Create booking
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    
    let paymentStatus = 'FREE';
    let bookingStatus = 'CONFIRMED';
    
    if (show.isPaid && totalAmount > 0) {
      paymentStatus = 'PENDING';
      bookingStatus = 'PENDING';
    } else {
      totalAmount = 0;
    }
    
    const bookingId = `BK${Date.now()}${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    
    const booking = await Booking.create({
      bookingId,
      userId,
      showId,
      timingId: currentTiming !== show ? timingId : null,
      theaterId: show.theaterId,
      movieName: show.movie.name,
      showDate: currentTiming.showDate || show.showDate,
      showTime: currentTiming.startTime || show.startTime,
      seats: bookedSeats,
      totalSeats: seats.length,
      totalAmount,
      paymentStatus,
      bookingStatus,
      expiresAt
    });
    
    // Update bookingId in seats
    for (const category of seatCategories) {
      for (const row of category.rows) {
        for (const seat of row.seats) {
          if (seat.bookedBy && seat.bookedBy.toString() === userId && !seat.bookingId) {
            seat.bookingId = booking._id;
          }
        }
      }
    }
    
    if (currentTiming !== show) {
      const timingIndex = show.timings.findIndex(t => t._id.toString() === timingId);
      show.timings[timingIndex].seatCategories = seatCategories;
    } else {
      show.seatCategories = seatCategories;
    }
    await show.save();
    
    res.status(201).json({
      success: true,
      message: paymentStatus === 'PENDING' ? 'Booking created. Complete payment within 15 minutes' : 'Booking confirmed',
      data: {
        bookingId: booking.bookingId,
        totalAmount,
        paymentStatus,
        bookingStatus,
        expiresAt,
        seats: bookedSeats
      }
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get buyer's bookings
// @route   GET /api/buyer/bookings
const getBuyerBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const bookings = await Booking.find({ userId })
      .populate('showId', 'movie.name movie.poster showDate startTime screenNumber')
      .sort({ bookedAt: -1 });
    
    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('Error in getBuyerBookings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel buyer's booking
// @route   PUT /api/buyer/booking/cancel/:bookingId
const cancelBuyerBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    
    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    if (booking.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }
    
    if (booking.bookingStatus === 'CONFIRMED' || booking.bookingStatus === 'PENDING') {
      booking.bookingStatus = 'CANCELLED';
      booking.cancelledAt = new Date();
      booking.cancelledBy = 'USER';
      await booking.save();
      
      // Release seats
      const show = await Show.findById(booking.showId);
      if (show) {
        let seatCategories;
        if (booking.timingId) {
          const timingIndex = show.timings.findIndex(t => t._id.toString() === booking.timingId.toString());
          if (timingIndex !== -1) {
            seatCategories = show.timings[timingIndex].seatCategories;
          }
        } else {
          seatCategories = show.seatCategories;
        }
        
        if (seatCategories) {
          for (const seat of booking.seats) {
            for (const category of seatCategories) {
              for (const row of category.rows) {
                if (row.rowName === seat.rowName) {
                  const seatObj = row.seats.find(s => s.seatNumber === seat.seatNumber);
                  if (seatObj && seatObj.bookedBy && seatObj.bookedBy.toString() === userId) {
                    seatObj.isBooked = false;
                    seatObj.bookedBy = null;
                    seatObj.bookingId = null;
                  }
                }
              }
            }
          }
          
          if (booking.timingId) {
            const timingIndex = show.timings.findIndex(t => t._id.toString() === booking.timingId.toString());
            if (timingIndex !== -1) {
              show.timings[timingIndex].seatCategories = seatCategories;
            }
          } else {
            show.seatCategories = seatCategories;
          }
          await show.save();
        }
      }
      
      res.json({ success: true, message: 'Booking cancelled successfully' });
    } else {
      res.status(400).json({ success: false, message: `Cannot cancel booking with status ${booking.bookingStatus}` });
    }
  } catch (error) {
    console.error('Error in cancelBuyerBooking:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get buyer's accessible theaters (where seats are assigned)
// @route   GET /api/buyer/my-theaters
const getBuyerTheaters = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId).select('accessibleSeats');
    
    if (!user?.accessibleSeats || user.accessibleSeats.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }
    
    const theaterIds = user.accessibleSeats.map(seat => seat.theaterId).filter(Boolean);
    
    const theaters = await Theater.find({ _id: { $in: theaterIds } }).select('name location city address');
    
    // Add accessible seat count for each theater
    const theatersWithAccess = theaters.map(theater => {
      const theaterAccess = user.accessibleSeats.find(
        seat => seat.theaterId?.toString() === theater._id.toString()
      );
      return {
        ...theater.toObject(),
        accessibleSeatCount: theaterAccess?.seatNumbers?.length || 0,
        accessibleSeatNumbers: theaterAccess?.seatNumbers || []
      };
    });
    
    res.json({
      success: true,
      count: theatersWithAccess.length,
      data: theatersWithAccess
    });
  } catch (error) {
    console.error('Error in getBuyerTheaters:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getBuyerShows,
  getBuyerShowsByTheater,
  getBuyerShowSeats,
  createBuyerBooking,
  getBuyerBookings,
  cancelBuyerBooking,
  getBuyerTheaters
};