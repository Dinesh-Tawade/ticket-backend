const mongoose = require('mongoose');

const showOverrideSchema = new mongoose.Schema({
  showId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Show',
    required: true,
  },
  isBookingEnabled: {
    type: Boolean,
    required: true,
  },
  reason: {
    type: String,
    default: '',
  },
  expiresAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

const bookingSettingsSchema = new mongoose.Schema({
  singletonKey: {
    type: String,
    default: 'global',
    unique: true,
  },
  isBookingEnabled: {
    type: Boolean,
    default: false,
  },
  disabledReason: {
    type: String,
    default: 'Online booking is temporarily disabled.',
  },
  maxTicketsPerBooking: {
    type: Number,
    default: 40,
    min: 1,
  },
  isMaintenanceMode: {
    type: Boolean,
    default: false,
  },
  maintenanceMessage: {
    type: String,
    default: 'Booking is currently under maintenance.',
  },
  showOverrides: [showOverrideSchema],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true });

bookingSettingsSchema.methods.isBookingEnabledForShow = async function(showId) {
  if (this.isMaintenanceMode) {
    return {
      enabled: false,
      reason: this.maintenanceMessage || 'Booking is currently under maintenance.',
    };
  }

  const showIdText = showId?.toString();
  const activeOverride = this.showOverrides?.find((override) => {
    if (override.showId?.toString() !== showIdText) return false;
    return !override.expiresAt || new Date(override.expiresAt) > new Date();
  });

  if (activeOverride) {
    return {
      enabled: activeOverride.isBookingEnabled,
      reason: activeOverride.reason || (activeOverride.isBookingEnabled ? null : this.disabledReason),
    };
  }

  return {
    enabled: this.isBookingEnabled,
    reason: this.isBookingEnabled ? null : this.disabledReason,
  };
};

bookingSettingsSchema.statics.getSingleton = async function() {
  let settings = await this.findOne({ singletonKey: 'global' });
  if (!settings) {
    settings = await this.create({ singletonKey: 'global' });
  }
  return settings;
};

module.exports = mongoose.model('BookingSettings', bookingSettingsSchema);
