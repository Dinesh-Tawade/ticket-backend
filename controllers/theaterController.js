const Theater = require('../models/Theater');
const Show = require('../models/Show');
const Booking = require('../models/Booking');
const User = require('../models/User');

// ==================== HELPER FUNCTIONS ====================

const calculateTotalSeatsFromZones = (zones) => {
  if (!zones || zones.length === 0) return 0;
  return zones.reduce((sum, zone) => {
    if (zone.rows && zone.rows.length > 0) {
      return sum + zone.rows.reduce((rowSum, row) => rowSum + (row.seatCount || row.seats?.length || 0), 0);
    }
    return sum + (zone.totalSeats || 0);
  }, 0);
};

const calculateTotalZones = (screens) => {
  if (!screens || screens.length === 0) return 0;
  return screens.reduce((sum, screen) => sum + (screen.zones?.length || 0), 0);
};

const processZonesForStorage = (zones) => {
  if (!zones) return [];
  return zones.map(zone => ({
    ...zone,
    finalPrice: (zone.basePrice || 0) * (zone.priceMultiplier || 1),
    totalSeats: zone.rows ? zone.rows.reduce((sum, row) => sum + (row.seatCount || row.seats?.length || 0), 0) : (zone.totalSeats || 0),
    totalRows: zone.rows?.length || zone.totalRows || 0,
    rows: zone.rows?.map(row => ({
      ...row,
      seatCount: row.seatCount || row.seats?.length || 0,
      seats: row.seats?.map(seat => ({
        ...seat,
        seatNumber: seat.seatNumber || seat.seatLabel,
        seatLabel: seat.seatLabel || seat.seatNumber
      })) || []
    })) || []
  }));
};

const processScreensForStorage = (screens) => {
  if (!screens) return [];
  return screens.map(screen => ({
    screenNumber: screen.screenNumber,
    name: screen.name,
    position: screen.position || 'center',
    positionLabel: screen.positionLabel || 'Center Stage',
    totalRows: screen.totalRows || 0,
    totalColumns: screen.totalColumns || 0,
    totalZones: screen.zones?.length || 0,
    totalSeatsInScreen: calculateTotalSeatsFromZones(screen.zones),
    zones: processZonesForStorage(screen.zones),
    seatRows: screen.seatRows || [],
    status: screen.status || 'ACTIVE'
  }));
};

// ==================== THEATER MANAGEMENT ====================

const createTheater = async (req, res) => {
  try {
    const {
      ownerId, name, location, city, state, pincode, contactNumber,
      screens, images, amenities, screenPosition, layout
    } = req.body;

    const owner = await User.findOne({ _id: ownerId, role: 'THEATER_OWNER' });
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Theater owner not found' });
    }

    const processedScreens = processScreensForStorage(screens || []);
    const totalScreens = processedScreens.length;
    const totalZones = calculateTotalZones(processedScreens);
    const totalSeats = processedScreens.reduce((sum, screen) => sum + (screen.totalSeatsInScreen || 0), 0);

    const theater = await Theater.create({
      ownerId,
      name,
      location,
      city,
      state,
      pincode,
      contactNumber,
      screens: processedScreens,
      images: images || [],
      totalScreens,
      totalZones,
      totalSeats,
      screenPosition: screenPosition || 'top',
      layout: layout || {},
      hasRecliner: amenities?.hasRecliner || false,
      hasWifi: amenities?.hasWifi || false,
      hasParking: amenities?.hasParking || false,
      hasCafe: amenities?.hasCafe || false,
      hasWheelchair: amenities?.hasWheelchair || false,
      createdBy: req.user.id,
      status: 'ACTIVE'
    });

    res.status(201).json({
      success: true,
      message: 'Theater created successfully',
      data: theater
    });
  } catch (error) {
    console.error('Create theater error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllTheaters = async (req, res) => {
  try {
    const { city, status, ownerId } = req.query;
    let filter = {};
    if (city) filter.city = new RegExp(city, 'i');
    if (status) filter.status = status;
    if (ownerId) filter.ownerId = ownerId;

    const theaters = await Theater.find(filter)
      .populate('ownerId', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: theaters.length, data: theaters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTheaterById = async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id)
      .populate('ownerId', 'name email phone')
      .populate('createdBy', 'name email');

    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    res.json({ success: true, data: theater });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateTheater = async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const {
      name, location, city, state, pincode, contactNumber, status,
      screens, images, amenities, screenPosition, layout
    } = req.body;

    if (name !== undefined) theater.name = name;
    if (location !== undefined) theater.location = location;
    if (city !== undefined) theater.city = city;
    if (state !== undefined) theater.state = state;
    if (pincode !== undefined) theater.pincode = pincode;
    if (contactNumber !== undefined) theater.contactNumber = contactNumber;
    if (status !== undefined) theater.status = status;
    if (screenPosition !== undefined) theater.screenPosition = screenPosition;
    if (layout !== undefined) theater.layout = layout;

    if (amenities) {
      if (amenities.hasRecliner !== undefined) theater.hasRecliner = amenities.hasRecliner;
      if (amenities.hasWifi !== undefined) theater.hasWifi = amenities.hasWifi;
      if (amenities.hasParking !== undefined) theater.hasParking = amenities.hasParking;
      if (amenities.hasCafe !== undefined) theater.hasCafe = amenities.hasCafe;
      if (amenities.hasWheelchair !== undefined) theater.hasWheelchair = amenities.hasWheelchair;
    }

    if (screens !== undefined) {
      theater.screens = processScreensForStorage(screens);
      theater.totalScreens = theater.screens.length;
      theater.totalZones = calculateTotalZones(theater.screens);
      theater.totalSeats = theater.screens.reduce((sum, screen) => sum + (screen.totalSeatsInScreen || 0), 0);
    }

    if (images !== undefined) theater.images = images;

    theater.updatedBy = req.user.id;
    await theater.save();

    res.json({ success: true, message: 'Theater updated successfully', data: theater });
  } catch (error) {
    console.error('Update theater error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteTheater = async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const activeShows = await Show.findOne({ 
      theaterId: req.params.id, 
      status: { $in: ['BOOKING_OPEN', 'COMING_SOON'] } 
    });
    
    if (activeShows) {
      return res.status(400).json({ success: false, message: 'Cannot delete theater with active shows' });
    }

    await theater.deleteOne();
    res.json({ success: true, message: 'Theater deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SCREEN MANAGEMENT ====================

const addScreenToTheater = async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const { screenNumber, name, position, positionLabel, zones, seatRows } = req.body;

    const newScreen = {
      screenNumber: screenNumber || theater.screens.length + 1,
      name: name || `Screen ${theater.screens.length + 1}`,
      position: position || 'center',
      positionLabel: positionLabel || 'Center Stage',
      totalRows: 0,
      totalColumns: 0,
      totalZones: zones?.length || 0,
      totalSeatsInScreen: calculateTotalSeatsFromZones(zones),
      zones: processZonesForStorage(zones || []),
      seatRows: seatRows || [],
      status: 'ACTIVE'
    };

    theater.screens.push(newScreen);
    theater.totalScreens = theater.screens.length;
    theater.totalZones = calculateTotalZones(theater.screens);
    theater.totalSeats = theater.screens.reduce((sum, screen) => sum + (screen.totalSeatsInScreen || 0), 0);

    await theater.save();

    res.json({ success: true, message: 'Screen added successfully', data: theater.screens });
  } catch (error) {
    console.error('Add screen error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateScreenInTheater = async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const screen = theater.screens.id(req.params.screenId);
    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
    }

    const { name, position, positionLabel, zones, seatRows, status } = req.body;

    if (name !== undefined) screen.name = name;
    if (position !== undefined) screen.position = position;
    if (positionLabel !== undefined) screen.positionLabel = positionLabel;
    if (status !== undefined) screen.status = status;
    
    if (zones !== undefined) {
      screen.zones = processZonesForStorage(zones);
      screen.totalZones = zones.length;
      screen.totalSeatsInScreen = calculateTotalSeatsFromZones(zones);
    }
    
    if (seatRows !== undefined) screen.seatRows = seatRows;

    theater.totalZones = calculateTotalZones(theater.screens);
    theater.totalSeats = theater.screens.reduce((sum, s) => sum + (s.totalSeatsInScreen || 0), 0);

    await theater.save();

    res.json({ success: true, message: 'Screen updated successfully', data: theater.screens });
  } catch (error) {
    console.error('Update screen error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteScreenFromTheater = async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const activeShows = await Show.findOne({ 
      theaterId: req.params.id, 
      screenId: req.params.screenId,
      status: { $in: ['BOOKING_OPEN', 'COMING_SOON'] }
    });
    
    if (activeShows) {
      return res.status(400).json({ success: false, message: 'Cannot delete screen with active shows' });
    }

    theater.screens.pull({ _id: req.params.screenId });
    theater.totalScreens = theater.screens.length;
    theater.totalZones = calculateTotalZones(theater.screens);
    theater.totalSeats = theater.screens.reduce((sum, s) => sum + (s.totalSeatsInScreen || 0), 0);

    await theater.save();
    
    res.json({ success: true, message: 'Screen deleted successfully', data: theater.screens });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ZONE MANAGEMENT ====================

const addZoneToScreen = async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const screen = theater.screens.id(req.params.screenId);
    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
    }

    const { zone } = req.body;
    
    const processedZone = processZonesForStorage([zone])[0];
    screen.zones.push(processedZone);
    screen.totalZones = screen.zones.length;
    screen.totalSeatsInScreen = calculateTotalSeatsFromZones(screen.zones);
    
    theater.totalZones = calculateTotalZones(theater.screens);
    theater.totalSeats = theater.screens.reduce((sum, s) => sum + (s.totalSeatsInScreen || 0), 0);

    await theater.save();

    res.json({ success: true, message: 'Zone added successfully', data: screen.zones });
  } catch (error) {
    console.error('Add zone error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateZoneInScreen = async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const screen = theater.screens.id(req.params.screenId);
    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
    }

    const zoneIndex = screen.zones.findIndex(z => z.id === req.params.zoneId || z._id.toString() === req.params.zoneId);
    if (zoneIndex === -1) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }

    const { zone } = req.body;
    const updatedZone = processZonesForStorage([{ ...screen.zones[zoneIndex].toObject(), ...zone }])[0];
    
    screen.zones[zoneIndex] = updatedZone;
    screen.totalSeatsInScreen = calculateTotalSeatsFromZones(screen.zones);
    
    theater.totalZones = calculateTotalZones(theater.screens);
    theater.totalSeats = theater.screens.reduce((sum, s) => sum + (s.totalSeatsInScreen || 0), 0);

    await theater.save();

    res.json({ success: true, message: 'Zone updated successfully', data: screen.zones });
  } catch (error) {
    console.error('Update zone error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteZoneFromScreen = async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const screen = theater.screens.id(req.params.screenId);
    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
    }

    screen.zones = screen.zones.filter(z => z.id !== req.params.zoneId && z._id.toString() !== req.params.zoneId);
    screen.totalZones = screen.zones.length;
    screen.totalSeatsInScreen = calculateTotalSeatsFromZones(screen.zones);
    
    theater.totalZones = calculateTotalZones(theater.screens);
    theater.totalSeats = theater.screens.reduce((sum, s) => sum + (s.totalSeatsInScreen || 0), 0);

    await theater.save();

    res.json({ success: true, message: 'Zone deleted successfully', data: screen.zones });
  } catch (error) {
    console.error('Delete zone error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SHOW MANAGEMENT ====================

const createShow = async (req, res) => {
  try {
    const {
      theaterId, screenId, screenNumber, movie, showDate, startTime, endTime,
      seatCategories, isPaid, basePrice
    } = req.body;

    const theater = await Theater.findById(theaterId);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const screen = theater.screens.id(screenId);
    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
    }

    let generatedSeatCategories = [];

    if (screen.zones && screen.zones.length > 0) {
      for (const zone of screen.zones) {
        const rows = [];
        for (const row of zone.rows) {
          const seats = [];
          for (let i = 1; i <= row.seatCount; i++) {
            seats.push({
              seatNumber: `${row.rowName}${i}`,
              seatLabel: row.seats.find(s => s.columnNumber === i)?.seatLabel || `${row.rowName}${i}`,
              seatId: `${zone.id}_row_${row.rowNumber}_seat_${i}`,
              isBooked: false,
              bookedBy: null,
              bookingId: null
            });
          }
          rows.push({ rowName: row.rowName, seats });
        }
        
        generatedSeatCategories.push({
          category: zone.seatType,
          zoneId: zone.id,
          zoneName: zone.name,
          position: zone.position,
          color: zone.color,
          icon: zone.icon,
          rows: rows,
          pricePerSeat: zone.finalPrice || (zone.basePrice * zone.priceMultiplier),
          totalSeats: rows.reduce((acc, row) => acc + row.seats.length, 0),
          availableSeats: rows.reduce((acc, row) => acc + row.seats.length, 0)
        });
      }
    } else if (screen.seatRows && screen.seatRows.length > 0 && seatCategories) {
      for (const categoryConfig of seatCategories) {
        const categoryRows = screen.seatRows.filter(row => row.category === categoryConfig.category);
        const rows = [];
        for (const rowConfig of categoryRows) {
          const seats = [];
          for (let i = rowConfig.startSeat; i <= rowConfig.endSeat; i++) {
            seats.push({
              seatNumber: i,
              seatLabel: `${rowConfig.rowName}${i}`,
              isBooked: false,
              bookedBy: null,
              bookingId: null
            });
          }
          rows.push({ rowName: rowConfig.rowName, seats });
        }
        generatedSeatCategories.push({
          category: categoryConfig.category,
          rows: rows,
          pricePerSeat: categoryConfig.pricePerSeat,
          totalSeats: rows.reduce((acc, row) => acc + row.seats.length, 0),
          availableSeats: rows.reduce((acc, row) => acc + row.seats.length, 0)
        });
      }
    }

    const show = await Show.create({
      theaterId,
      screenId,
      screenNumber: screenNumber || screen.screenNumber,
      movie,
      showDate: new Date(showDate),
      startTime,
      endTime,
      seatCategories: generatedSeatCategories,
      isPaid: isPaid || false,
      basePrice: basePrice || 0,
      status: 'BOOKING_OPEN',
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, message: 'Show created successfully', data: show });
  } catch (error) {
    console.error('Create show error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllShows = async (req, res) => {
  try {
    const { theaterId, status, fromDate, toDate } = req.query;
    let filter = {};
    
    if (theaterId) filter.theaterId = theaterId;
    if (status) filter.status = status;
    if (fromDate && toDate) {
      filter.showDate = { $gte: new Date(fromDate), $lte: new Date(toDate) };
    }

    const shows = await Show.find(filter)
      .populate('theaterId', 'name location city')
      .sort({ showDate: 1, startTime: 1 });

    res.json({ success: true, count: shows.length, data: shows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDetailedShowById = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id)
      .populate('theaterId', 'name location city state screens totalSeats screenPosition')
      .populate('createdBy', 'name email');

    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    const theater = await Theater.findById(show.theaterId);
    const screen = theater?.screens?.find(s => s._id.toString() === show.screenId.toString());

    res.json({ 
      success: true, 
      data: {
        ...show.toObject(),
        theaterLayout: {
          screenPosition: theater?.screenPosition,
          screenName: screen?.name,
          screenPosition: screen?.position,
          zones: screen?.zones
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateShow = async (req, res) => {
  try {
    const { isPaid, basePrice, status, movie, showDate, startTime, endTime, seatCategories } = req.body;
    const show = await Show.findById(req.params.id);

    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    if (isPaid !== undefined) show.isPaid = isPaid;
    if (basePrice !== undefined) show.basePrice = basePrice;
    if (status !== undefined) show.status = status;
    if (movie !== undefined) show.movie = { ...show.movie.toObject ? show.movie.toObject() : show.movie, ...movie };
    if (showDate !== undefined) show.showDate = new Date(showDate);
    if (startTime !== undefined) show.startTime = startTime;
    if (endTime !== undefined) show.endTime = endTime;
    if (seatCategories !== undefined) show.seatCategories = seatCategories;

    await show.save();

    res.json({ success: true, message: 'Show updated successfully', data: show });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateShowStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const show = await Show.findById(req.params.id);
    
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    show.status = status;
    await show.save();

    res.json({ success: true, message: `Show status updated to ${status}`, data: show });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteShow = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id);
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    const bookings = await Booking.findOne({ showId: req.params.id, bookingStatus: 'CONFIRMED' });
    if (bookings) {
      return res.status(400).json({ success: false, message: 'Cannot delete show with confirmed bookings' });
    }

    await show.deleteOne();
    res.json({ success: true, message: 'Show deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const setAllShowsPaymentMode = async (req, res) => {
  try {
    const { isPaid } = req.body;

    if (typeof isPaid !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isPaid must be true or false' });
    }

    const result = await Show.updateMany({}, { isPaid: isPaid });

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount || 0} shows to ${isPaid ? 'paid' : 'free'}`,
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== EXPORTS ====================
module.exports = {
  // Theater operations
  createTheater,
  getAllTheaters,
  getTheaterById,
  updateTheater,
  deleteTheater,
  
  // Screen operations
  addScreenToTheater,
  updateScreenInTheater,
  deleteScreenFromTheater,
  
  // Zone operations
  addZoneToScreen,
  updateZoneInScreen,
  deleteZoneFromScreen,
  
  // Show operations
  createShow,
  getAllShows,
  getDetailedShowById,
  updateShow,
  updateShowStatus,
  deleteShow,
  setAllShowsPaymentMode
};