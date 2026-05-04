const Booking = require('../models/Booking');
const Show = require('../models/Show');
const Theater = require('../models/Theater');
const User = require('../models/User');

// @desc    Verify ticket by QR code data
// @route   POST /api/verify/ticket
const verifyTicket = async (req, res) => {
  try {
    const { qrData } = req.body;
    
    if (!qrData) {
      return res.status(400).json({ 
        success: false, 
        message: 'QR data is required' 
      });
    }

    // Parse QR data format: "BOOKING_ID|ROW|SEAT|ROW+SEAT"
    const parts = qrData.split('|');
    
    let bookingId, scannedRow, scannedSeat, scannedRowSeat;
    
    if (parts.length === 4) {
      bookingId = parts[0];
      scannedRow = parts[1];
      scannedSeat = parts[2];
      scannedRowSeat = parts[3];
    } else {
      // Fallback: if only booking ID
      bookingId = qrData;
    }

    // Find booking
    const booking = await Booking.findOne({ bookingId })
      .populate('showId', 'movie.name movie.poster showDate startTime endTime status')
      .populate('theaterId', 'name location city')
      .populate('userId', 'name email phone');

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid ticket: Booking not found',
        isValid: false 
      });
    }

    // Check booking status
    if (booking.bookingStatus !== 'CONFIRMED') {
      let message = '';
      switch (booking.bookingStatus) {
        case 'PENDING':
          message = 'Ticket payment pending. Please complete payment.';
          break;
        case 'CANCELLED':
          message = 'Ticket has been cancelled.';
          break;
        case 'EXPIRED':
          message = 'Ticket has expired.';
          break;
        default:
          message = `Ticket status: ${booking.bookingStatus}`;
      }
      return res.status(400).json({ 
        success: false, 
        message,
        isValid: false,
        bookingStatus: booking.bookingStatus
      });
    }

    // Check payment status for paid shows
    if (booking.paymentStatus === 'PENDING') {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment pending. Please complete payment.',
        isValid: false 
      });
    }

    // Get show details
    const show = await Show.findById(booking.showId);
    if (!show) {
      return res.status(404).json({ 
        success: false, 
        message: 'Show not found',
        isValid: false 
      });
    }

    // Check if show has already ended
    const showDateTime = new Date(show.showDate);
    const [hours, minutes] = show.endTime.split(':');
    showDateTime.setHours(parseInt(hours), parseInt(minutes));
    
    if (new Date() > showDateTime) {
      return res.status(400).json({ 
        success: false, 
        message: 'This show has already ended. Ticket cannot be used.',
        isValid: false 
      });
    }

    // Verify seat matches (if row and seat provided in QR)
    let seatVerified = true;
    let matchedSeat = null;
    
    if (scannedRow && scannedSeat) {
      matchedSeat = booking.seats.find(
        seat => seat.rowName === scannedRow && seat.seatNumber === parseInt(scannedSeat)
      );
      
      if (!matchedSeat) {
        seatVerified = false;
        return res.status(400).json({ 
          success: false, 
          message: `Seat mismatch. This ticket is for different seat.`,
          isValid: false,
          expectedSeats: booking.seats.map(s => `${s.rowName}${s.seatNumber}`)
        });
      }
    }

    // Check if ticket already used (you can add a 'used' field to track)
    if (booking.isUsed) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ticket has already been used for entry.',
        isValid: false,
        usedAt: booking.usedAt
      });
    }

    // Ticket is valid
    res.json({
      success: true,
      isValid: true,
      message: 'Ticket is valid',
      data: {
        bookingId: booking.bookingId,
        customer: {
          name: booking.userId?.name,
          email: booking.userId?.email,
          phone: booking.userId?.phone
        },
        show: {
          movieName: show.movie.name,
          poster: show.movie.poster,
          date: show.showDate,
          startTime: show.startTime,
          endTime: show.endTime,
          status: show.status
        },
        theater: {
          name: booking.theaterId?.name,
          location: booking.theaterId?.location,
          city: booking.theaterId?.city
        },
        seats: booking.seats.map(s => ({
          row: s.rowName,
          seatNumber: s.seatNumber,
          category: s.category,
          price: s.price
        })),
        totalAmount: booking.totalAmount,
        paymentStatus: booking.paymentStatus,
        bookedAt: booking.bookedAt,
        qrMatchedSeat: matchedSeat ? {
          row: matchedSeat.rowName,
          seatNumber: matchedSeat.seatNumber
        } : null
      }
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Verification failed: ' + error.message,
      isValid: false 
    });
  }
};

// @desc    Mark ticket as used (after entry)
// @route   PUT /api/verify/ticket/use/:bookingId
const markTicketAsUsed = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { seatIndex } = req.body; // Optional: specific seat index

    const booking = await Booking.findOne({ bookingId });

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    if (booking.bookingStatus !== 'CONFIRMED') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot mark ticket as used. Status: ${booking.bookingStatus}` 
      });
    }

    if (booking.isUsed) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ticket already marked as used' 
      });
    }

    booking.isUsed = true;
    booking.usedAt = new Date();
    booking.usedBy = req.user.id;
    await booking.save();

    res.json({
      success: true,
      message: 'Ticket marked as used successfully',
      data: {
        bookingId: booking.bookingId,
        usedAt: booking.usedAt
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get ticket details by booking ID (for display)
// @route   GET /api/verify/ticket/:bookingId
const getTicketDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findOne({ bookingId })
      .populate('showId', 'movie.name movie.poster movie.genre movie.duration movie.language showDate startTime endTime')
      .populate('theaterId', 'name location city contactNumber')
      .populate('userId', 'name email phone');

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket not found' 
      });
    }

    // Check if user is authorized (theater owner of that theater or super admin)
    let isAuthorized = false;
    
    if (req.user.role === 'SUPER_ADMIN') {
      isAuthorized = true;
    } else if (req.user.role === 'THEATER_OWNER') {
      // Check if this theater belongs to this owner
      const theater = await Theater.findOne({ 
        _id: booking.theaterId, 
        ownerId: req.user.id 
      });
      if (theater) isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to view this ticket' 
      });
    }

    res.json({
      success: true,
      data: {
        bookingId: booking.bookingId,
        customer: {
          name: booking.userId?.name,
          email: booking.userId?.email,
          phone: booking.userId?.phone
        },
        show: booking.showId,
        theater: booking.theaterId,
        seats: booking.seats,
        totalAmount: booking.totalAmount,
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.bookingStatus,
        isUsed: booking.isUsed || false,
        usedAt: booking.usedAt,
        bookedAt: booking.bookedAt
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all tickets for a show (Theater Owner/Admin)
// @route   GET /api/verify/show/:showId/tickets
const getShowTickets = async (req, res) => {
  try {
    const { showId } = req.params;

    const bookings = await Booking.find({ 
      showId, 
      bookingStatus: 'CONFIRMED' 
    }).populate('userId', 'name email phone');

    // Calculate stats
    const stats = {
      totalTickets: bookings.reduce((sum, b) => sum + b.seats.length, 0),
      totalBookings: bookings.length,
      totalRevenue: bookings.reduce((sum, b) => sum + b.totalAmount, 0),
      usedTickets: bookings.filter(b => b.isUsed).reduce((sum, b) => sum + b.seats.length, 0),
      checkedIn: bookings.filter(b => b.isUsed).length
    };

    res.json({
      success: true,
      stats,
      count: bookings.length,
      data: bookings
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  verifyTicket,
  markTicketAsUsed,
  getTicketDetails,
  getShowTickets
};