const BookingSettings = require('../models/BookingSettings');
const Show = require('../models/Show');

const formatSettings = (settings) => ({
  _id: settings._id,
  isBookingEnabled: settings.isBookingEnabled,
  disabledReason: settings.disabledReason,
  maxTicketsPerBooking: settings.maxTicketsPerBooking,
  isMaintenanceMode: settings.isMaintenanceMode,
  maintenanceMessage: settings.maintenanceMessage,
  showOverrides: settings.showOverrides || [],
  updatedAt: settings.updatedAt,
});

const getBookingSettings = async (req, res) => {
  try {
    const settings = await BookingSettings.getSingleton();
    res.json({ success: true, data: formatSettings(settings) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateBookingSettings = async (req, res) => {
  try {
    const settings = await BookingSettings.getSingleton();
    const {
      isBookingEnabled,
      disabledReason,
      maxTicketsPerBooking,
      isMaintenanceMode,
      maintenanceMessage,
    } = req.body;

    if (typeof isBookingEnabled === 'boolean') settings.isBookingEnabled = isBookingEnabled;
    if (typeof disabledReason === 'string') settings.disabledReason = disabledReason.trim() || settings.disabledReason;
    if (Number.isFinite(Number(maxTicketsPerBooking)) && Number(maxTicketsPerBooking) > 0) {
      settings.maxTicketsPerBooking = Number(maxTicketsPerBooking);
    }
    if (typeof isMaintenanceMode === 'boolean') settings.isMaintenanceMode = isMaintenanceMode;
    if (typeof maintenanceMessage === 'string') settings.maintenanceMessage = maintenanceMessage.trim() || settings.maintenanceMessage;
    settings.updatedBy = req.user?.id || null;

    await settings.save();
    res.json({ success: true, message: 'Booking settings updated successfully', data: formatSettings(settings) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPublicBookingSettings = async (req, res) => {
  try {
    const settings = await BookingSettings.getSingleton();
    res.json({
      success: true,
      data: {
        isBookingEnabled: settings.isBookingEnabled && !settings.isMaintenanceMode,
        disabledReason: settings.isMaintenanceMode
          ? settings.maintenanceMessage
          : settings.disabledReason,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPublicShowBookingStatus = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id);
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    const bookingStatus = await show.isBookingAvailable(req.query.timingId || null);
    res.json({
      success: true,
      data: {
        isBookingEnabled: bookingStatus.available,
        disabledReason: bookingStatus.reason,
        settings: bookingStatus.settings,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getBookingSettings,
  updateBookingSettings,
  getPublicBookingSettings,
  getPublicShowBookingStatus,
};
