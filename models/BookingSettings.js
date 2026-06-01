import mongoose from 'mongoose';

const bookingSettingsSchema = new mongoose.Schema({
  // Global booking toggle
  isBookingEnabled: {
    type: Boolean,
    default: true,
    required: true
  },
  
  // Show-specific overrides
  showOverrides: [{
    showId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Show'
    },
    isBookingEnabled: {
      type: Boolean,
      required: true
    },
    reason: String,
    expiresAt: Date
  }],
  
  // Time-based restrictions
  timeRestrictions: {
    enabled: {
      type: Boolean,
      default: false
    },
    allowedHours: {
      start: { type: String, default: '00:00' },
      end: { type: String, default: '23:59' }
    },
    allowedDays: {
      type: [Number], // 0-6 (Sunday-Saturday)
      default: [0, 1, 2, 3, 4, 5, 6]
    }
  },
  
  // Advance booking limit (days before show)
  advanceBookingLimit: {
    type: Number,
    default: 30,
    min: 0,
    max: 365
  },
  
  // Minimum advance notice (hours before show)
  minimumNoticeHours: {
    type: Number,
    default: 2,
    min: 0,
    max: 48
  },
  
  // Maximum tickets per booking
  maxTicketsPerBooking: {
    type: Number,
    default: 10,
    min: 1,
    max: 50
  },
  
  // Maintenance mode
  isMaintenanceMode: {
    type: Boolean,
    default: false
  },
  
  // Maintenance message
  maintenanceMessage: {
    type: String,
    default: 'Booking system is temporarily unavailable. Please try again later.'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Method to check if booking is enabled for a specific show
bookingSettingsSchema.methods.isBookingEnabledForShow = async function(showId, showDate) {
  // Check maintenance mode first
  if (this.isMaintenanceMode) {
    return { enabled: false, reason: this.maintenanceMessage };
  }
  
  // Check global toggle
  if (!this.isBookingEnabled) {
    return { enabled: false, reason: 'Booking is currently disabled globally.' };
  }
  
  // Check show-specific override
  const override = this.showOverrides.find(
    o => o.showId.toString() === showId.toString()
  );
  
  if (override) {
    // Check if override has expired
    if (override.expiresAt && new Date() > override.expiresAt) {
      // Remove expired override
      this.showOverrides = this.showOverrides.filter(
        o => o.showId.toString() !== showId.toString()
      );
      await this.save();
    } else {
      return { 
        enabled: override.isBookingEnabled, 
        reason: override.reason || 'Booking restricted for this show.'
      };
    }
  }
  
  // Check time restrictions
  if (this.timeRestrictions.enabled) {
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMinute = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;
    const currentDay = now.getDay();
    
    // Check if current day is allowed
    if (!this.timeRestrictions.allowedDays.includes(currentDay)) {
      return { 
        enabled: false, 
        reason: 'Booking is not available on this day of the week.' 
      };
    }
    
    // Check if current time is within allowed hours
    if (currentTime < this.timeRestrictions.allowedHours.start ||
        currentTime > this.timeRestrictions.allowedHours.end) {
      return { 
        enabled: false, 
        reason: `Booking is only available between ${this.timeRestrictions.allowedHours.start} and ${this.timeRestrictions.allowedHours.end}.` 
      };
    }
  }
  
  // Check advance booking limit
  const showDateTime = new Date(showDate);
  const daysUntilShow = Math.ceil((showDateTime - new Date()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilShow > this.advanceBookingLimit) {
    return { 
      enabled: false, 
      reason: `Booking can only be done within ${this.advanceBookingLimit} days of the show.` 
    };
  }
  
  // Check minimum notice period
  const hoursUntilShow = (showDateTime - new Date()) / (1000 * 60 * 60);
  if (hoursUntilShow < this.minimumNoticeHours) {
    return { 
      enabled: false, 
      reason: `Booking closes ${this.minimumNoticeHours} hours before the show.` 
    };
  }
  
  return { enabled: true, reason: null };
};

export default mongoose.models.BookingSettings || mongoose.model('BookingSettings', bookingSettingsSchema);