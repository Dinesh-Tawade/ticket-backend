const Show = require('../models/Show');
const Booking = require('../models/Booking');
const User = require('../models/User');
const BookingSettings = require('../models/BookingSettings');

/** Merge all active seat assignments for a theater (multiple zones supported). */
const collectAccessibleSeatNumbers = (accessibleSeats, theaterId) => {
  if (!accessibleSeats?.length || !theaterId) return [];

  const theaterIdStr = theaterId.toString();
  const seatSet = new Set();

  for (const access of accessibleSeats) {
    if (access.theaterId?.toString() !== theaterIdStr) continue;
    if (access.isActive === false) continue;
    if (access.validUntil && new Date() > new Date(access.validUntil)) continue;
    (access.seatNumbers || []).forEach((num) => {
      if (num) seatSet.add(num);
    });
  }

  return [...seatSet];
};

const resolveSeatCategories = (show, timingId) => {
  if (timingId && show.timings?.length) {
    const timing = show.timings.find((t) => t._id.toString() === timingId);
    if (timing?.seatCategories?.length) return timing.seatCategories;
  }
  return show.seatCategories || [];
};

const normalizeSeatKey = (value) =>
  value ? String(value).trim().toUpperCase().replace(/\s+/g, '') : '';

const isSeatAccessible = (seatNumber, accessibleSeatNumbers, seatLabel = null) => {
  if (!accessibleSeatNumbers.length) return false;
  const normalizedList = accessibleSeatNumbers.map(normalizeSeatKey);
  const candidates = [seatNumber, seatLabel]
    .filter(Boolean)
    .map(normalizeSeatKey);
  if (candidates.some((c) => normalizedList.includes(c))) return true;
  // Legacy: stored as row+number without full label
  const primary = seatNumber || seatLabel;
  const rowMatch = primary?.match(/^([A-Z]+)/i);
  if (rowMatch) {
    const suffix = primary.slice(rowMatch[1].length);
    const alt = normalizeSeatKey(`${rowMatch[1]}${suffix}`);
    return normalizedList.includes(alt);
  }
  return false;
};

// @desc    Get Available Seats for a Show (With Accessible Seats Filter)
// @route   GET /api/public/shows/:id/seats
const getAvailableSeats = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id);
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    const { timingId } = req.query;
    const theaterId = show.theaterId?._id || show.theaterId;

    let accessibleSeatNumbers = [];
    if (req.user?.id) {
      const user = await User.findById(req.user.id).select('accessibleSeats role');
      accessibleSeatNumbers = collectAccessibleSeatNumbers(user?.accessibleSeats, theaterId);

      // Theater owners / buyers with assignments must only see assigned seats
      if (
        accessibleSeatNumbers.length === 0 &&
        user &&
        ['THEATER_OWNER', 'BUYER'].includes(user.role) &&
        user.accessibleSeats?.some((a) => a.theaterId?.toString() === theaterId?.toString())
      ) {
        return res.json({
          success: true,
          data: {
            showId: show._id,
            movieName: show.movie?.name,
            showDate: show.showDate,
            startTime: show.startTime,
            seatMap: {},
            seatCategories: [],
            totalSeats: show.totalSeats,
            availableSeats: show.availableSeats,
            accessibleSeats: [],
            message: 'No active seat access for this theater',
          },
        });
      }
    }

    const seatCategories = resolveSeatCategories(show, timingId);
    const seatMap = {};
    const enrichedCategories = JSON.parse(JSON.stringify(seatCategories)).map((category) => ({
      ...category,
      rows: (category.rows || []).map((row) => ({
        ...row,
        seats: (row.seats || []).map((seat) => {
          const accessible = isSeatAccessible(
            seat.seatNumber,
            accessibleSeatNumbers,
            seat.seatLabel
          );
          const entry = {
            seatNumber: seat.seatNumber,
            rowName: row.rowName,
            isBooked: !!seat.isBooked,
            price: show.isPaid ? category.pricePerSeat : 0,
            isAccessible: accessible,
          };
          if (!seatMap[category.category]) seatMap[category.category] = {};
          if (!seatMap[category.category][row.rowName]) seatMap[category.category][row.rowName] = [];
          seatMap[category.category][row.rowName].push(entry);
          return { ...seat, ...entry };
        }),
      })),
    }));

    res.json({
      success: true,
      data: {
        showId: show._id,
        movieName: show.movie?.name,
        showDate: show.showDate,
        startTime: show.startTime,
        seatMap,
        seatCategories: enrichedCategories,
        totalSeats: show.totalSeats,
        availableSeats: show.availableSeats,
        accessibleSeats: accessibleSeatNumbers,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Book Tickets (With Accessible Seats Validation)
// @route   POST /api/public/booking/create
const createBooking = async (req, res) => {
  try {
    const { showId, seats, timingId } = req.body;
    const userId = req.user.id;
    console.log('🔍 Received booking request:', JSON.stringify({ showId, timingId, seats }, null, 2));
    if (!seats || seats.length === 0) {
      return res.status(400).json({ success: false, message: 'No seats selected' });
    }

    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    const bookingAvailability = await show.isBookingAvailable(timingId || null);
    if (!bookingAvailability.available) {
      return res.status(403).json({
        success: false,
        message: bookingAvailability.reason || 'Booking is currently disabled.',
      });
    }

    const settings = await BookingSettings.getSingleton();
    if (seats.length > settings.maxTicketsPerBooking) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${settings.maxTicketsPerBooking} seats per booking`,
      });
    }

    // Get current timing if multiple timings exist
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

    const user = await User.findById(userId).select('accessibleSeats role');
    const theaterId = show.theaterId?._id || show.theaterId;
    const accessibleSeatNumbers = collectAccessibleSeatNumbers(user?.accessibleSeats, theaterId);

    // Users with assigned seats can only book those seats
    if (accessibleSeatNumbers.length > 0) {
      for (const selectedSeat of seats) {
        const seatId = selectedSeat.seatNumber;
        if (!isSeatAccessible(seatId, accessibleSeatNumbers)) {
          return res.status(403).json({
            success: false,
            message: `Seat ${seatId} is not assigned to you. You can only book: ${accessibleSeatNumbers.join(', ')}`,
          });
        }
      }
    } else if (
      user &&
      ['THEATER_OWNER', 'BUYER'].includes(user.role) &&
      user.accessibleSeats?.some((a) => a.theaterId?.toString() === theaterId?.toString())
    ) {
      return res.status(403).json({
        success: false,
        message: 'You have no active seat access for this theater. Contact admin.',
      });
    }

    let totalAmount = 0;
    const bookedSeats = [];
    
    // Use seatCategories from currentTiming if available
    let seatCategories = currentTiming.seatCategories || show.seatCategories;
    seatCategories = JSON.parse(JSON.stringify(seatCategories)); // Deep clone

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

    // Update seatCategories back to show/timing
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

    // Generate unique booking ID
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

// @desc    Create Payment Order (For Paid Shows)
// @route   POST /api/public/booking/create-payment-order/:bookingId
const createPaymentOrder = async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.userId.toString() !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.paymentStatus !== 'PENDING' || booking.bookingStatus !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Payment order cannot be created for this booking' });
    }

    // Check if booking is expired
    if (new Date() > booking.expiresAt) {
      booking.bookingStatus = 'EXPIRED';
      await booking.save();
      
      const show = await Show.findById(booking.showId);
      for (const seat of booking.seats) {
        for (const category of show.seatCategories) {
          for (const row of category.rows) {
            if (row.rowName === seat.rowName) {
              const seatObj = row.seats.find(s => s.seatNumber === seat.seatNumber);
              if (seatObj && seatObj.bookedBy && seatObj.bookedBy.toString() === booking.userId.toString()) {
                seatObj.isBooked = false;
                seatObj.bookedBy = null;
                seatObj.bookingId = null;
              }
            }
          }
        }
      }
      await show.save();
      
      return res.status(400).json({ success: false, message: 'Booking expired. Please book again' });
    }

    const paymentOrderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    const paymentOrder = {
      orderId: paymentOrderId,
      bookingId: booking.bookingId,
      amount: booking.totalAmount,
      currency: 'INR',
      receipt: booking.bookingId,
      createdAt: new Date(),
      expiresAt: booking.expiresAt
    };

    res.json({ success: true, data: paymentOrder });
  } catch (error) {
    console.error('Create payment order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Confirm Payment (For Paid Shows)
// @route   PUT /api/public/booking/confirm-payment/:bookingId
const confirmPayment = async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.userId.toString() !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.bookingStatus !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Booking is already ${booking.bookingStatus}` });
    }

    if (new Date() > booking.expiresAt) {
      booking.bookingStatus = 'EXPIRED';
      await booking.save();
      
      const show = await Show.findById(booking.showId);
      for (const seat of booking.seats) {
        for (const category of show.seatCategories) {
          for (const row of category.rows) {
            if (row.rowName === seat.rowName) {
              const seatObj = row.seats.find(s => s.seatNumber === seat.seatNumber);
              if (seatObj) {
                seatObj.isBooked = false;
                seatObj.bookedBy = null;
                seatObj.bookingId = null;
              }
            }
          }
        }
      }
      await show.save();
      
      return res.status(400).json({ success: false, message: 'Booking expired. Please book again' });
    }

    const { paymentId, paymentMethod, gatewayResponse } = req.body;

    booking.paymentStatus = 'PAID';
    booking.bookingStatus = 'CONFIRMED';
    if (paymentId) booking.paymentId = paymentId;
    if (paymentMethod) booking.paymentMethod = paymentMethod;
    if (gatewayResponse) booking.paymentDetails = gatewayResponse;
    await booking.save();

    const show = await Show.findById(booking.showId);
    for (const seat of booking.seats) {
      for (const category of show.seatCategories) {
        for (const row of category.rows) {
          if (row.rowName === seat.rowName) {
            const seatObj = row.seats.find(s => s.seatNumber === seat.seatNumber);
            if (seatObj) {
              seatObj.bookingId = booking._id;
            }
          }
        }
      }
    }
    await show.save();

    res.json({ success: true, message: 'Payment confirmed. Booking successful!', data: booking });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get My Bookings
// @route   GET /api/public/booking/my-bookings
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id })
      .sort({ bookedAt: -1 })
      .populate('showId', 'movie.name movie.poster showDate startTime');

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel Booking
// @route   PUT /api/public/booking/cancel/:bookingId
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.userId.toString() !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.bookingStatus === 'CONFIRMED' || booking.bookingStatus === 'PENDING') {
      booking.bookingStatus = 'CANCELLED';
      booking.cancelledAt = new Date();
      booking.cancelledBy = req.user.role === 'SUPER_ADMIN' ? 'ADMIN' : 'USER';
      await booking.save();

      const show = await Show.findById(booking.showId);
      for (const seat of booking.seats) {
        for (const category of show.seatCategories) {
          for (const row of category.rows) {
            if (row.rowName === seat.rowName) {
              const seatObj = row.seats.find(s => s.seatNumber === seat.seatNumber);
              if (seatObj) {
                seatObj.isBooked = false;
                seatObj.bookedBy = null;
                seatObj.bookingId = null;
              }
            }
          }
        }
      }
      await show.save();

      res.json({ success: true, message: 'Booking cancelled successfully' });
    } else {
      res.status(400).json({ success: false, message: `Cannot cancel booking with status ${booking.bookingStatus}` });
    }
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Bookings (Admin)
// @route   GET /api/admin/booking/all
const getAllBookings = async (req, res) => {
  try {
    const { status, fromDate, toDate } = req.query;
    let filter = {};
    
    if (status) filter.bookingStatus = status;
    if (fromDate && toDate) {
      filter.bookedAt = { $gte: new Date(fromDate), $lte: new Date(toDate) };
    }

    const bookings = await Booking.find(filter)
      .populate('userId', 'name email')
      .populate('showId', 'movie.name showDate startTime')
      .sort({ bookedAt: -1 });

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Auto-cancel expired pending bookings
const autoCancelExpiredBookings = async () => {
  try {
    const expiredBookings = await Booking.find({
      bookingStatus: 'PENDING',
      expiresAt: { $lt: new Date() }
    });

    for (const booking of expiredBookings) {
      booking.bookingStatus = 'EXPIRED';
      await booking.save();

      const show = await Show.findById(booking.showId);
      if (show) {
        for (const seat of booking.seats) {
          for (const category of show.seatCategories) {
            for (const row of category.rows) {
              if (row.rowName === seat.rowName) {
                const seatObj = row.seats.find(s => s.seatNumber === seat.seatNumber);
                if (seatObj && seatObj.bookedBy && seatObj.bookedBy.toString() === booking.userId.toString()) {
                  seatObj.isBooked = false;
                  seatObj.bookedBy = null;
                  seatObj.bookingId = null;
                }
              }
            }
          }
        }
        await show.save();
      }
    }
    
    console.log(`Auto-cancelled ${expiredBookings.length} expired bookings`);
  } catch (error) {
    console.error('Auto-cancel error:', error);
  }
};

// @desc    Get All Active Shows (Public) - WITH ACCESSIBLE SEATS FILTER
// @route   GET /api/public/shows
const getAllShows = async (req, res) => {
  try {
    let filter = {
      status: 'BOOKING_OPEN',
      showDate: { $gte: new Date() }
    };
    
    const { date, movieId, theaterId, city } = req.query;
    
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      filter.showDate = { $gte: startDate, $lt: endDate };
    }
    
    if (movieId) filter['movie.movieId'] = movieId;
    if (theaterId) filter.theaterId = theaterId;
    if (city) filter.city = city;
    
    const shows = await Show.find(filter)
      .populate('theaterId', 'name location city address')
      .sort({ showDate: 1, startTime: 1 });
    
    // Get user's accessible seats
    const user = await User.findById(req.user.id).select('accessibleSeats');
    
    // Filter shows where user has accessible seats
    const showsWithAccess = shows.filter(show => {
      if (!user?.accessibleSeats) return false;
      
      const theaterAccess = user.accessibleSeats.find(
        seat => seat.theaterId?.toString() === show.theaterId?._id?.toString()
      );
      
      return theaterAccess && theaterAccess.seatNumbers && theaterAccess.seatNumbers.length > 0;
    });
    
    res.json({
      success: true,
      count: showsWithAccess.length,
      data: showsWithAccess
    });
  } catch (error) {
    console.error('Error in getAllShows:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Shows by Movie (Public) - WITH ACCESSIBLE SEATS FILTER
// @route   GET /api/public/shows/movie/:movieId
const getShowsByMovie = async (req, res) => {
  try {
    const shows = await Show.find({
      'movie.movieId': req.params.movieId,
      status: 'BOOKING_OPEN',
      showDate: { $gte: new Date() }
    })
    .populate('theaterId', 'name location city address')
    .sort({ showDate: 1, startTime: 1 });
    
    // Get user's accessible seats
    const user = await User.findById(req.user.id).select('accessibleSeats');
    
    // Filter shows where user has accessible seats
    const showsWithAccess = shows.filter(show => {
      if (!user?.accessibleSeats) return false;
      
      const theaterAccess = user.accessibleSeats.find(
        seat => seat.theaterId?.toString() === show.theaterId?._id?.toString()
      );
      
      return theaterAccess && theaterAccess.seatNumbers && theaterAccess.seatNumbers.length > 0;
    });
    
    res.json({
      success: true,
      count: showsWithAccess.length,
      data: showsWithAccess
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Shows by Theater (Public) - WITH ACCESSIBLE SEATS FILTER
// @route   GET /api/public/shows/theater/:theaterId
const getShowsByTheater = async (req, res) => {
  try {
    const shows = await Show.find({
      theaterId: req.params.theaterId,
      status: 'BOOKING_OPEN',
      showDate: { $gte: new Date() }
    })
    .populate('theaterId', 'name location city address')  
    .sort({ showDate: 1, startTime: 1 });
    
    // Get user's accessible seats
    const user = await User.findById(req.user.id).select('accessibleSeats');
    
    // Check if user has accessible seats for this theater
    let hasAccess = false;
    if (user?.accessibleSeats) {
      const theaterAccess = user.accessibleSeats.find(
        seat => seat.theaterId?.toString() === req.params.theaterId
      );
      hasAccess = theaterAccess && theaterAccess.seatNumbers && theaterAccess.seatNumbers.length > 0;
    }
    
    // If user doesn't have access, return empty array
    if (!hasAccess) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }
    
    res.json({
      success: true,
      count: shows.length,
      data: shows
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAvailableSeats,
  createBooking,
  createPaymentOrder,
  confirmPayment,
  getMyBookings,
  cancelBooking,
  getAllBookings,
  autoCancelExpiredBookings,
  getAllShows,
  getShowsByMovie,
  getShowsByTheater
};
