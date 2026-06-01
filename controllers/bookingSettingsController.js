import BookingSettings from '../models/BookingSettings.js';
import Show from '../models/Show.js';

// Get current booking settings
export const getBookingSettings = async (req, res) => {
  try {
    let settings = await BookingSettings.findOne().populate('showOverrides.showId', 'name showDate');
    
    if (!settings) {
      settings = await BookingSettings.create({});
    }
    
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update global settings
export const updateGlobalSettings = async (req, res) => {
  try {
    const {
      isBookingEnabled,
      timeRestrictions,
      advanceBookingLimit,
      minimumNoticeHours,
      maxTicketsPerBooking,
      isMaintenanceMode,
      maintenanceMessage
    } = req.body;
    
    let settings = await BookingSettings.findOne();
    
    if (!settings) {
      settings = new BookingSettings();
    }
    
    // Update fields
    if (isBookingEnabled !== undefined) settings.isBookingEnabled = isBookingEnabled;
    if (timeRestrictions) settings.timeRestrictions = timeRestrictions;
    if (advanceBookingLimit !== undefined) settings.advanceBookingLimit = advanceBookingLimit;
    if (minimumNoticeHours !== undefined) settings.minimumNoticeHours = minimumNoticeHours;
    if (maxTicketsPerBooking !== undefined) settings.maxTicketsPerBooking = maxTicketsPerBooking;
    if (isMaintenanceMode !== undefined) settings.isMaintenanceMode = isMaintenanceMode;
    if (maintenanceMessage !== undefined) settings.maintenanceMessage = maintenanceMessage;
    
    settings.updatedBy = req.user.id;
    settings.updatedAt = new Date();
    
    await settings.save();
    
    res.status(200).json({
      success: true,
      data: settings,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Add show-specific override
export const addShowOverride = async (req, res) => {
  try {
    const { showId, isBookingEnabled, reason, expiresAt } = req.body;
    
    // Verify show exists
    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({
        success: false,
        message: 'Show not found'
      });
    }
    
    let settings = await BookingSettings.findOne();
    if (!settings) {
      settings = new BookingSettings();
    }
    
    // Remove existing override for this show if any
    settings.showOverrides = settings.showOverrides.filter(
      o => o.showId.toString() !== showId
    );
    
    // Add new override
    settings.showOverrides.push({
      showId,
      isBookingEnabled,
      reason,
      expiresAt: expiresAt || null
    });
    
    settings.updatedBy = req.user.id;
    settings.updatedAt = new Date();
    
    await settings.save();
    
    res.status(200).json({
      success: true,
      data: settings,
      message: 'Show override added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Remove show override
export const removeShowOverride = async (req, res) => {
  try {
    const { showId } = req.params;
    
    let settings = await BookingSettings.findOne();
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found'
      });
    }
    
    settings.showOverrides = settings.showOverrides.filter(
      o => o.showId.toString() !== showId
    );
    
    settings.updatedBy = req.user.id;
    settings.updatedAt = new Date();
    
    await settings.save();
    
    res.status(200).json({
      success: true,
      data: settings,
      message: 'Show override removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Check booking availability for a specific show
export const checkShowBookingAvailability = async (req, res) => {
  try {
    const { showId } = req.params;
    
    const show = await Show.findById(showId);
    if (!show) {
      return res.status(404).json({
        success: false,
        message: 'Show not found'
      });
    }
    
    const bookingStatus = await show.isBookingAvailable();
    
    res.status(200).json({
      success: true,
      data: bookingStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all shows with booking status
export const getAllShowsBookingStatus = async (req, res) => {
  try {
    const shows = await Show.find({ status: 'BOOKING_OPEN' });
    
    const showsWithStatus = await Promise.all(
      shows.map(async (show) => {
        const bookingStatus = await show.isBookingAvailable();
        return {
          showId: show._id,
          movieName: show.movie?.name,
          showDate: show.showDate,
          startTime: show.startTime,
          bookingAvailable: bookingStatus.available,
          reason: bookingStatus.reason,
          availableSeats: show.availableSeats
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: showsWithStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};