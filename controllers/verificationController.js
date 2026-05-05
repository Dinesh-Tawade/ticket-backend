const Booking = require('../models/Booking');
const Show = require('../models/Show');

// @desc    Verify ticket by QR code data
// @route   POST /api/verify/ticket
const verifyTicket = async (req, res) => {
  try {
    const { qrData } = req.body;
    
    console.log('=== VERIFY TICKET REQUEST ===');
    console.log('QR Data:', qrData);
    
    if (!qrData) {
      return res.status(400).json({ 
        success: false, 
        message: 'QR data is required',
        isValid: false 
      });
    }

    // Parse QR data format: "BOOKING_ID|ROW|SEAT|ROW+SEAT"
    const parts = qrData.split('|');
    let bookingId = parts[0];

    console.log('Extracted Booking ID:', bookingId);

    // Find booking
    const booking = await Booking.findOne({ bookingId })
      .populate('userId', 'name email phone')
      .populate('showId', 'movie.name movie.poster movie.duration movie.genre movie.language showDate startTime endTime')
      .populate('theaterId', 'name location city');

    console.log('Found Booking:', booking ? 'YES' : 'NO');

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid ticket: Booking not found',
        isValid: false 
      });
    }

    // Check booking status
    if (booking.bookingStatus !== 'CONFIRMED') {
      return res.status(400).json({ 
        success: false, 
        message: `Ticket status: ${booking.bookingStatus}. Cannot verify.`,
        isValid: false 
      });
    }

    // Check payment status
    if (booking.paymentStatus === 'PENDING') {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment pending. Please complete payment.',
        isValid: false 
      });
    }

    // Check if already checked in
    if (booking.isCheckedIn) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ticket has already been used for entry.',
        isValid: false,
        checkedInAt: booking.checkedInAt
      });
    }

    // Prepare response
    const responseData = {
      bookingId: booking.bookingId,
      customer: {
        name: booking.userId?.name || 'Guest',
        email: booking.userId?.email || 'N/A',
        phone: booking.userId?.phone || 'N/A'
      },
      movieName: booking.movieName || booking.showId?.movie?.name,
      theater: {
        name: booking.theaterId?.name || 'N/A',
        location: booking.theaterId?.location || 'N/A',
        city: booking.theaterId?.city || 'N/A'
      },
      showDate: booking.showDate,
      showTime: booking.showTime,
      screenNumber: booking.screenNumber || 1,
      seats: booking.seats,
      totalAmount: booking.totalAmount,
      paymentStatus: booking.paymentStatus,
      isCheckedIn: booking.isCheckedIn || false,
      checkedInAt: booking.checkedInAt,
      checkedInSeatsCount: booking.checkedInSeatsCount || 0,
      totalSeats: booking.totalSeats || booking.seats?.length || 0
    };

    res.json({
      success: true,
      isValid: true,
      message: 'Ticket is valid',
      data: responseData
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

// @desc    Mark ticket as used (check-in)
// @route   PUT /api/verify/ticket/use/:bookingId
const markTicketAsUsed = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    console.log('=== CHECK-IN REQUEST ===');
    console.log('Booking ID:', bookingId);
    console.log('Checked in by:', req.user?.id);

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
        message: `Cannot check in. Booking status: ${booking.bookingStatus}` 
      });
    }

    if (booking.isCheckedIn) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ticket already checked in' 
      });
    }

    // Mark as checked in
    booking.isCheckedIn = true;
    booking.checkedInAt = new Date();
    booking.checkedInBy = req.user?.id;
    booking.checkedInSeatsCount = booking.seats?.length || 0;
    
    await booking.save();

    console.log('Check-in successful for:', bookingId);

    res.json({
      success: true,
      message: 'Check-in successful',
      data: {
        bookingId: booking.bookingId,
        checkedInAt: booking.checkedInAt
      }
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get ticket details
// @route   GET /api/verify/ticket/:bookingId
const getTicketDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findOne({ bookingId })
      .populate('userId', 'name email phone')
      .populate('showId', 'movie.name movie.poster showDate startTime endTime')
      .populate('theaterId', 'name location city');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all tickets for a show
// @route   GET /api/verify/show/:showId/tickets
const getShowTickets = async (req, res) => {
  try {
    const { showId } = req.params;

    const bookings = await Booking.find({ 
      showId, 
      bookingStatus: 'CONFIRMED' 
    }).populate('userId', 'name email phone');

    const stats = {
      totalTickets: bookings.reduce((sum, b) => sum + (b.seats?.length || 0), 0),
      totalBookings: bookings.length,
      totalRevenue: bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
      checkedInTickets: bookings.filter(b => b.isCheckedIn).reduce((sum, b) => sum + (b.seats?.length || 0), 0),
      checkedInBookings: bookings.filter(b => b.isCheckedIn).length
    };

    res.json({ success: true, stats, data: bookings });
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