// Find your existing getPublicShowById function and update it like this:

export const getPublicShowById = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id)
      .populate('movieId', 'name poster description duration genre language rating releaseDate isTrending')
      .populate('theaterId', 'name location city');
    
    if (!show) {
      return res.status(404).json({
        success: false,
        message: 'Show not found'
      });
    }
    
    // Get dynamic booking availability
    const bookingStatus = await show.isBookingAvailable();
    
    // Add booking availability to response
    const showData = show.toObject();
    showData.isBookingEnabled = bookingStatus.available;
    showData.bookingDisabledReason = bookingStatus.reason;
    showData.maxTicketsPerBooking = bookingStatus.settings?.maxTicketsPerBooking || 10;
    
    res.status(200).json({
      success: true,
      data: showData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};