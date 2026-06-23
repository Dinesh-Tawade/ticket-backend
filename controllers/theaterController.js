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
    // totalRows: zone.rows?.length || zone.totalRows || 0,
    totalRows: Math.max(
      zone.rows?.length || 0,
      zone.totalRows || 0,
      0
    ),
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

// Generate seat categories from screen zones
const generateSeatCategoriesFromZones = (screen) => {
  const seatCategories = [];
  
  if (screen.zones && screen.zones.length > 0) {
    for (const zone of screen.zones) {
      const rows = [];
      for (const row of zone.rows) {
        const seats = [];
        if (row.seats && row.seats.length > 0) {
          // Use actual seats from the layout to preserve column numbers, aisles, and custom labels
          for (const seat of row.seats) {
            seats.push({
              seatNumber: seat.seatNumber || `${row.rowName}${seat.columnNumber}`,
              seatLabel: seat.seatLabel || seat.seatNumber || `${row.rowName}${seat.columnNumber}`,
              isBooked: seat.isAvailable === false || !!seat.isBooked,
              bookedBy: seat.bookedBy || null,
              bookingId: seat.bookingId || null,
              price: zone.finalPrice || (zone.basePrice * zone.priceMultiplier)
            });
          }
        } else {
          // Fallback to sequential generation if no seats array is defined
          for (let i = 1; i <= row.seatCount; i++) {
            seats.push({
              seatNumber: `${row.rowName}${i}`,
              seatLabel: `${row.rowName}${i}`,
              isBooked: false,
              bookedBy: null,
              bookingId: null,
              price: zone.finalPrice || (zone.basePrice * zone.priceMultiplier)
            });
          }
        }
        rows.push({ rowName: row.rowName, seats });
      }
      
      seatCategories.push({
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
  }
  
  return seatCategories;
};

// ==================== THEATER MANAGEMENT ====================

const createTheater = async (req, res) => {
  try {
    const {
      name, location, city, state, pincode, contactNumber,
      screens, images, amenities, screenPosition, layout,
      hasRecliner, hasWifi, hasParking, hasCafe, hasWheelchair,
      layoutMeta, totalScreens: reqTotalScreens, totalZones: reqTotalZones, totalSeats: reqTotalSeats
    } = req.body;

    const processedScreens = processScreensForStorage(screens || []);
    const totalScreens = processedScreens.length;
    const totalZones = calculateTotalZones(processedScreens);
    const totalSeats = processedScreens.reduce((sum, screen) => sum + (screen.totalSeatsInScreen || 0), 0);

    const theaterData = {
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
      layoutMeta: layoutMeta || {},
      hasRecliner: hasRecliner !== undefined ? hasRecliner : (amenities?.hasRecliner || false),
      hasWifi: hasWifi !== undefined ? hasWifi : (amenities?.hasWifi || false),
      hasParking: hasParking !== undefined ? hasParking : (amenities?.hasParking || false),
      hasCafe: hasCafe !== undefined ? hasCafe : (amenities?.hasCafe || false),
      hasWheelchair: hasWheelchair !== undefined ? hasWheelchair : (amenities?.hasWheelchair || false),
      createdBy: req.user.id,
      status: 'ACTIVE'
    };

    let theater;
    try {
      theater = await Theater.create(theaterData);
    } catch (err) {
      // If duplicate key error on screens.zones.id, drop the stale unique index and retry
      if (err.code === 11000 && err.message?.includes('screens.zones.id')) {
        console.log('⚠️ Detected stale unique index on screens.zones.id — dropping and retrying...');
        try {
          await Theater.collection.dropIndex('screens.zones.id_1');
          console.log('✅ Dropped stale index screens.zones.id_1');
        } catch (dropErr) {
          console.log('Index drop attempt:', dropErr.message);
        }
        try {
          await Theater.collection.dropIndex('screens.zones.rows.rowId_1');
          console.log('✅ Dropped stale index screens.zones.rows.rowId_1');
        } catch (dropErr) {
          // ignore
        }
        // Retry the create
        theater = await Theater.create(theaterData);
      } else {
        throw err;
      }
    }

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
      screens, images, amenities, screenPosition, layout,
      hasRecliner, hasWifi, hasParking, hasCafe, hasWheelchair,
      layoutMeta, totalScreens, totalZones, totalSeats
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
    if (layoutMeta !== undefined) theater.layoutMeta = layoutMeta;

    // Handle amenities - both from direct fields and nested amenities object
    if (hasRecliner !== undefined) theater.hasRecliner = hasRecliner;
    if (hasWifi !== undefined) theater.hasWifi = hasWifi;
    if (hasParking !== undefined) theater.hasParking = hasParking;
    if (hasCafe !== undefined) theater.hasCafe = hasCafe;
    if (hasWheelchair !== undefined) theater.hasWheelchair = hasWheelchair;

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

// ==================== SHOW MANAGEMENT (UPDATED WITH MULTIPLE TIMINGS) ====================

// @desc    Create Show with multiple timings
// @route   POST /api/admin/show/create
const createShow = async (req, res) => {
  try {
    const {
      theaterId, screenId, screenNumber, movie,
      timings, isPaid, basePrice
    } = req.body;

    const theater = await Theater.findById(theaterId);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    const screen = theater.screens.id(screenId);
    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
    }

    if (!timings || timings.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one show timing is required' 
      });
    }

    const processedTimings = [];
    const currentDate = new Date();

    for (const timing of timings) {
      const { showDate, startTime, endTime } = timing;

      if (!showDate || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: 'Each timing must have showDate, startTime, and endTime'
        });
      }

      // Check if timing is expired - AGAR PAST HAI TO SKIP KARO
      const showDateTime = new Date(showDate);
      const [hours, minutes] = startTime.split(':');
      showDateTime.setHours(parseInt(hours), parseInt(minutes));
      
      if (showDateTime < currentDate) {
        console.log(`Skipping expired timing: ${showDate} ${startTime}`);
        continue; // Skip - yeh timing create mat karo
      }

      const seatCategories = generateSeatCategoriesFromZones(screen);
      
      if (seatCategories.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No zones configured for this screen. Please add zones first.'
        });
      }

      const totalSeats = seatCategories.reduce((acc, cat) => acc + cat.totalSeats, 0);

      processedTimings.push({
        showDate: new Date(showDate),
        startTime,
        endTime,
        status: 'BOOKING_OPEN',
        seatCategories: seatCategories,
        totalSeats,
        availableSeats: totalSeats,
        bookedSeatsCount: 0
      });
    }

    // Agar saari timings expired hain to show hi mat banao
    if (processedTimings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All provided timings are expired. Cannot create show.'
      });
    }

    const show = await Show.create({
      theaterId,
      screenId,
      screenNumber: screenNumber || screen.screenNumber,
      movie,
      timings: processedTimings,
      isPaid: isPaid || false,
      basePrice: basePrice || 0,
      createdBy: req.user.id,
      showDate: processedTimings[0].showDate,
      startTime: processedTimings[0].startTime,
      endTime: processedTimings[0].endTime,
      seatCategories: processedTimings[0].seatCategories,
      status: processedTimings[0].status,
      totalSeats: processedTimings[0].totalSeats,
      availableSeats: processedTimings[0].availableSeats,
      bookedSeatsCount: 0
    });

    res.status(201).json({ 
      success: true, 
      message: `Show created with ${processedTimings.length} upcoming timing(s)`, 
      data: show 
    });
  } catch (error) {
    console.error('Create show error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Shows (Admin) - Updated to handle timings
// @route   GET /api/admin/show/all
const getAllShows = async (req, res) => {
  try {
    const { theaterId, movieId, city } = req.query;
    
    // IMPORTANT: Use UTC to avoid timezone issues
    const now = new Date();
    const currentUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      0
    ));
    
    console.log('Current UTC Time:', currentUTC);
    
    let filter = {};
    if (theaterId) filter.theaterId = theaterId;
    if (movieId) filter.movie = movieId;
    
    let shows = await Show.find(filter)
      .populate('theaterId', 'name location city')
      .sort({ createdAt: -1 });
    
    const upcomingShows = [];
    
    for (const show of shows) {
      const showObj = show.toObject();
      
      if (!showObj.timings || showObj.timings.length === 0) {
        console.log(`Show ${show._id}: No timings, skipping`);
        continue;
      }
      
      const upcomingTimings = [];
      
      for (const timing of showObj.timings) {
        // Create UTC date from showDate and startTime
        const showDateUTC = new Date(timing.showDate);
        const [hours, minutes] = timing.startTime.split(':').map(Number);
        showDateUTC.setUTCHours(hours, minutes, 0, 0);
        
        console.log(`Show ${show._id}: Timing date=${timing.showDate}, time=${timing.startTime} -> UTC=${showDateUTC}`);
        console.log(`Compare: ${showDateUTC} > ${currentUTC} = ${showDateUTC > currentUTC}`);
        
        if (showDateUTC > currentUTC) {
          upcomingTimings.push(timing);
        }
      }
      
      if (upcomingTimings.length > 0) {
        showObj.timings = upcomingTimings;
        upcomingShows.push(showObj);
        console.log(`Show ${show._id}: Included with ${upcomingTimings.length} upcoming timings`);
      } else {
        console.log(`Show ${show._id}: SKIPPED - no upcoming timings`);
      }
    }
    
    res.json({ 
      success: true, 
      count: upcomingShows.length,
      debug: {
        currentUTC,
        totalShowsFound: shows.length,
        upcomingShowsCount: upcomingShows.length
      },
      data: upcomingShows 
    });
    
  } catch (error) {
    console.error('Get all shows error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Detailed Show By ID - Expired show pe 404 error
// @route   GET /api/admin/show/:id
const getDetailedShowById = async (req, res) => {
  try {
    const currentDate = new Date();
    
    const show = await Show.findById(req.params.id)
      .populate('theaterId', 'name location city state screens totalSeats screenPosition')
      .populate('createdBy', 'name email');

    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    const theater = await Theater.findById(show.theaterId);
    const screen = theater?.screens?.find(s => s._id.toString() === show.screenId.toString());

    const responseData = show.toObject();
    
    // ✅ Filter only upcoming timings
    let upcomingTimings = [];
    
    if (responseData.timings && responseData.timings.length > 0) {
      upcomingTimings = responseData.timings.filter(timing => {
        const showDateTime = new Date(timing.showDate);
        const [hours, minutes] = timing.startTime.split(':');
        showDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return showDateTime > currentDate;
      });
      
      responseData.timings = upcomingTimings;
    }
    
    // ✅ Agar koi upcoming timing nahi hai toh 404 error
    if (upcomingTimings.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'This show has expired and has no upcoming timings'
      });
    }
    
    res.json({ 
      success: true, 
      data: {
        ...responseData,
        theaterLayout: {
          theaterName: theater?.name,
          location: theater?.location,
          city: theater?.city,
          screenPosition: screen?.position,
          screenName: screen?.name,
          zones: screen?.zones
        }
      }
    });
    
  } catch (error) {
    console.error('Get detailed show error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Show Details - Updated to handle timings
// @route   PUT /api/admin/show/update/:id
const updateShow = async (req, res) => {
  try {
    const { isPaid, basePrice, status, movie, timings } = req.body;
    const show = await Show.findById(req.params.id);

    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    if (isPaid !== undefined) show.isPaid = isPaid;
    if (basePrice !== undefined) show.basePrice = basePrice;
    if (movie !== undefined) show.movie = { ...show.movie.toObject ? show.movie.toObject() : show.movie, ...movie };
    
    // Update timings if provided
    if (timings !== undefined && timings.length > 0) {
      show.timings = timings;
      // Sync legacy fields from first timing
      const firstTiming = timings[0];
      show.showDate = firstTiming.showDate;
      show.startTime = firstTiming.startTime;
      show.endTime = firstTiming.endTime;
      show.seatCategories = firstTiming.seatCategories;
      show.status = firstTiming.status;
      show.totalSeats = firstTiming.totalSeats;
      show.availableSeats = firstTiming.availableSeats;
      show.bookedSeatsCount = firstTiming.bookedSeatsCount;
    } else if (status !== undefined) {
      // Legacy mode
      show.status = status;
    }

    await show.save();

    res.json({ success: true, message: 'Show updated successfully', data: show });
  } catch (error) {
    console.error('Update show error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Show Status - Updated to handle timing-specific status
// @route   PUT /api/admin/show/update-status/:id
const updateShowStatus = async (req, res) => {
  try {
    const { status, timingId } = req.body;
    const show = await Show.findById(req.params.id);
    
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    // If timingId provided, update specific timing
    if (timingId && show.timings && show.timings.length > 0) {
      const timing = show.timings.id(timingId);
      if (!timing) {
        return res.status(404).json({ success: false, message: 'Timing not found' });
      }
      timing.status = status;
      
      // Sync legacy fields from first timing
      const firstTiming = show.timings[0];
      show.showDate = firstTiming.showDate;
      show.startTime = firstTiming.startTime;
      show.endTime = firstTiming.endTime;
      show.seatCategories = firstTiming.seatCategories;
      show.status = firstTiming.status;
      show.totalSeats = firstTiming.totalSeats;
      show.availableSeats = firstTiming.availableSeats;
      show.bookedSeatsCount = firstTiming.bookedSeatsCount;
    } else {
      // Legacy mode
      show.status = status;
    }
    
    await show.save();

    res.json({ success: true, message: `Show status updated to ${status}`, data: show });
  } catch (error) {
    console.error('Update show status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Show
// @route   DELETE /api/admin/show/delete/:id
const deleteShow = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id);
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    // Check for confirmed bookings
    const bookings = await Booking.findOne({ showId: req.params.id, bookingStatus: 'CONFIRMED' });
    if (bookings) {
      return res.status(400).json({ success: false, message: 'Cannot delete show with confirmed bookings' });
    }

    await show.deleteOne();
    res.json({ success: true, message: 'Show deleted successfully' });
  } catch (error) {
    console.error('Delete show error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Set all shows to free or paid
// @route   PUT /api/admin/shows/set-paid-all
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
    console.error('Set all shows payment mode error:', error);
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