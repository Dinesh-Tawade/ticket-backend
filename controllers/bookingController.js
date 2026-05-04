const Show = require('../models/Show');
const Booking = require('../models/Booking');
const User = require('../models/User');

// @desc    Get Available Seats for a Show
// @route   GET /api/public/shows/:id/seats
const getAvailableSeats = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id);
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    const seatMap = {};
    show.seatCategories.forEach(category => {
      seatMap[category.category] = {};
      category.rows.forEach(row => {
        seatMap[category.category][row.rowName] = row.seats.map(seat => ({
          seatNumber: seat.seatNumber,
          isBooked: seat.isBooked,
          price: category.pricePerSeat
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
        seatMap,
        totalSeats: show.totalSeats,
        availableSeats: show.availableSeats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Book Tickets
// @route   POST /api/public/booking/create
const createBooking = async (req, res) => {
  try {
    const { showId, seats } = req.body;
    const userId = req.user.id;

    // Max 40 seats per booking
    if (seats.length > 40) {
      return res.status(400).json({ success: false, message: 'Maximum 40 seats per booking' });
    }

    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    if (show.status !== 'BOOKING_OPEN') {
      return res.status(400).json({ success: false, message: `Show is ${show.status}. Cannot book tickets` });
    }

    // Check seat availability and calculate total amount
    let totalAmount = 0;
    const bookedSeats = [];
    const seatCategories = [...show.seatCategories];

    for (const selectedSeat of seats) {
      let seatFound = false;
      
      for (const category of seatCategories) {
        for (const row of category.rows) {
          if (row.rowName === selectedSeat.rowName) {
            const seat = row.seats.find(s => s.seatNumber === selectedSeat.seatNumber);
            if (seat && !seat.isBooked) {
              seat.isBooked = true;
              seat.bookedBy = userId;
              seatFound = true;
              totalAmount += category.pricePerSeat;
              bookedSeats.push({
                rowName: selectedSeat.rowName,
                seatNumber: selectedSeat.seatNumber,
                category: category.category,
                price: category.pricePerSeat
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
        return res.status(404).json({ success: false, message: `Seat ${selectedSeat.rowName}${selectedSeat.seatNumber} not found` });
      }
    }

    // Update show
    show.seatCategories = seatCategories;
    await show.save();

    // Calculate expiry time (15 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

   
    let paymentStatus = 'FREE';
    let bookingStatus = 'CONFIRMED';
    
    if (show.isPaid && totalAmount > 0) {
      paymentStatus = 'PENDING';
      bookingStatus = 'PENDING';
    }

    // Create booking
    const booking = await Booking.create({
      userId,
      showId,
      theaterId: show.theaterId,
      movieName: show.movie.name,
      showDate: show.showDate,
      showTime: show.startTime,
      seats: bookedSeats,
      totalSeats: seats.length,
      totalAmount,
      paymentStatus,
      bookingStatus,
      expiresAt
    });

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
      
      // Release seats
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

    booking.paymentStatus = 'PAID';
    booking.bookingStatus = 'CONFIRMED';
    await booking.save();

    // Update booking reference in show seats
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

      // Release seats
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

// Auto-cancel expired pending bookings (Run this as a cron job)
const autoCancelExpiredBookings = async () => {
  try {
    const expiredBookings = await Booking.find({
      bookingStatus: 'PENDING',
      expiresAt: { $lt: new Date() }
    });

    for (const booking of expiredBookings) {
      booking.bookingStatus = 'EXPIRED';
      await booking.save();

      // Release seats
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
// @desc    Get All Active Shows (Public)
// @route   GET /api/public/shows
const getAllShows = async (req, res) => {
  try {
    // Filter options
    let filter = {
      status: 'BOOKING_OPEN',  // Sirf booking open shows
      showDate: { $gte: new Date() } // Aaj aur future ke shows
    };
    
    // Optional filters (agar query params se filter karna ho)
    const { date, movieId, theaterId, city } = req.query;
    
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      filter.showDate = { $gte: startDate, $lt: endDate };
    }
    
    if (movieId) {
      filter['movie.movieId'] = movieId;
    }
    
    if (theaterId) {
      filter.theaterId = theaterId;
    }
    
    if (city) {
      filter.city = city;
    }
    
    const shows = await Show.find(filter)
      .populate('theaterId', 'name location city address') // Theater details
      .sort({ showDate: 1, startTime: 1 }); // Date aur time ke hisaab se sort
    
    res.json({
      success: true,
      count: shows.length,
      data: shows
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Shows by Movie (Public)
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
    
    res.json({
      success: true,
      count: shows.length,
      data: shows
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Shows by Theater (Public)
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
  confirmPayment,
  getMyBookings,
  cancelBooking,
  getAllBookings,
  autoCancelExpiredBookings,
  getAllShows,
  getShowsByMovie,
  getShowsByTheater
};