const User = require('../models/User');

const createTheaterOwner = async (req, res) => {
  try {
    const { 
      name, email, password, phone, address, theaters, 
      assignedZone, assignedSeats, accessibleSeats 
    } = req.body;

    console.log("Creating Theater Owner with data:", { 
      name, email, 
      accessibleSeats: accessibleSeats ? 'present' : 'missing',
      accessibleSeatsData: accessibleSeats 
    });

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Parse accessibleSeats if it comes as JSON string
    let parsedAccessibleSeats = [];
    if (accessibleSeats) {
      try {
        parsedAccessibleSeats = typeof accessibleSeats === 'string' 
          ? JSON.parse(accessibleSeats) 
          : accessibleSeats;
        console.log("Parsed accessibleSeats for Theater Owner:", parsedAccessibleSeats);
      } catch (e) {
        console.error('Error parsing accessibleSeats:', e);
      }
    }

    // Parse assignedSeats if needed
    let parsedAssignedSeats = [];
    if (assignedSeats) {
      try {
        parsedAssignedSeats = typeof assignedSeats === 'string' 
          ? JSON.parse(assignedSeats) 
          : assignedSeats;
      } catch (e) {
        console.error('Error parsing assignedSeats:', e);
      }
    }

    const user = await User.create({
      name, 
      email, 
      password,
      phone: phone || null,
      address: address || null,
      role: 'THEATER_OWNER',
      status: 'ACTIVE',
      theaters: theaters || [],
      assignedZone: assignedZone || null,
      assignedSeats: parsedAssignedSeats,
      accessibleSeats: parsedAccessibleSeats,  // ✅ CRITICAL: Theater owner ko bhi seat access
      createdBy: req.user ? req.user.id : null
    });

    console.log("Theater Owner created with accessibleSeats:", user.accessibleSeats);

    res.status(201).json({
      success: true,
      message: 'Theater Owner created successfully with seat access',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        theaters: user.theaters,
        accessibleSeats: user.accessibleSeats
      }
    });
  } catch (error) {
    console.error('Create theater owner error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createVendor = async (req, res) => {
  try {
    const { 
      name, email, password, phone, address, 
      vendorType, assignedTheater, storeName, storeLocation, 
      gstNumber, foodLicenseNumber, deliveryTime, 
      assignedZone, assignedSeats, accessibleSeats 
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    if (!assignedTheater) {
      return res.status(400).json({ success: false, message: "assignedTheater is required" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // 🔥 FIX: Support both Theater ID and Theater Owner ID
    let theaterOwnerId = assignedTheater;
    
    // First try to find as Theater
    const Theater = require('../models/Theater');
    const theater = await Theater.findById(assignedTheater);
    
    if (theater) {
      // If found as Theater, get its ownerId
      theaterOwnerId = theater.ownerId;
      console.log(`Found theater: ${theater.name}, owner: ${theaterOwnerId}`);
    } else {
      // If not found as Theater, check as User with role THEATER_OWNER
      const theaterOwner = await User.findOne({ _id: assignedTheater, role: 'THEATER_OWNER' });
      if (!theaterOwner) {
        return res.status(404).json({ 
          success: false, 
          message: 'Invalid theater selected. Please select a valid theater.',
          debug: { assignedTheater }
        });
      }
      theaterOwnerId = assignedTheater;
      console.log(`Found theater owner: ${theaterOwner.name}`);
    }

    // Parse accessibleSeats if it comes as JSON string
    let parsedAccessibleSeats = [];
    if (accessibleSeats) {
      try {
        parsedAccessibleSeats = typeof accessibleSeats === 'string' 
          ? JSON.parse(accessibleSeats) 
          : accessibleSeats;
        console.log("Parsed accessibleSeats for Vendor:", parsedAccessibleSeats);
      } catch (e) {
        console.error('Error parsing accessibleSeats:', e);
      }
    }

    // Parse assignedSeats if needed
    let parsedAssignedSeats = [];
    if (assignedSeats) {
      try {
        parsedAssignedSeats = typeof assignedSeats === 'string' 
          ? JSON.parse(assignedSeats) 
          : assignedSeats;
      } catch (e) {
        console.error('Error parsing assignedSeats:', e);
      }
    }

    const user = await User.create({
      name, email, password,
      phone: phone || null,
      address: address || null,
      role: 'VENDOR',
      status: 'ACTIVE',
      vendorType: vendorType || 'FOOD',
      assignedTheater: theaterOwnerId,
      storeName: storeName || null,
      storeLocation: storeLocation || null,
      gstNumber: gstNumber || null,
      foodLicenseNumber: foodLicenseNumber || null,
      deliveryTime: deliveryTime || 30,
      assignedZone: assignedZone || null,
      assignedSeats: parsedAssignedSeats,
      accessibleSeats: parsedAccessibleSeats,  // ✅ Vendor ko bhi seat access
      isOpen: true,
      createdBy: req.user ? req.user.id : null
    });

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: { 
        _id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        assignedTheater: user.assignedTheater,
        accessibleSeats: user.accessibleSeats
      }
    });
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createBuyer = async (req, res) => {
  try {
    const { 
      name, email, password, phone, address, 
      assignedZone, assignedSeats, accessibleSeats 
    } = req.body;

    console.log("Received createBuyer request:", { 
      name, email, role: 'BUYER', 
      accessibleSeats: accessibleSeats ? 'present' : 'missing',
      accessibleSeatsData: accessibleSeats 
    });

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Parse accessibleSeats if it comes as JSON string
    let parsedAccessibleSeats = [];
    if (accessibleSeats) {
      try {
        parsedAccessibleSeats = typeof accessibleSeats === 'string' 
          ? JSON.parse(accessibleSeats) 
          : accessibleSeats;
        console.log("Parsed accessibleSeats:", parsedAccessibleSeats);
      } catch (e) {
        console.error('Error parsing accessibleSeats:', e);
      }
    }

    // Parse assignedSeats if needed
    let parsedAssignedSeats = [];
    if (assignedSeats) {
      try {
        parsedAssignedSeats = typeof assignedSeats === 'string' 
          ? JSON.parse(assignedSeats) 
          : assignedSeats;
      } catch (e) {
        console.error('Error parsing assignedSeats:', e);
      }
    }

    const user = await User.create({
      name, 
      email, 
      password,
      phone: phone || null,
      address: address || null,
      role: 'BUYER',
      status: 'ACTIVE',
      assignedZone: assignedZone || null,
      assignedSeats: parsedAssignedSeats,
      accessibleSeats: parsedAccessibleSeats,  // ✅ CRITICAL FIX
      createdBy: req.user ? req.user.id : null
    });

    console.log("User created with accessibleSeats:", user.accessibleSeats);

    res.status(201).json({
      success: true,
      message: 'Buyer created successfully',
      data: { 
        _id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        accessibleSeats: user.accessibleSeats 
      }
    });
  } catch (error) {
    console.error('Create buyer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createSuperAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, address, assignedZone, assignedSeats, accessibleSeats } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Parse accessibleSeats if it comes as JSON string
    let parsedAccessibleSeats = [];
    if (accessibleSeats) {
      try {
        parsedAccessibleSeats = typeof accessibleSeats === 'string' 
          ? JSON.parse(accessibleSeats) 
          : accessibleSeats;
      } catch (e) {
        console.error('Error parsing accessibleSeats:', e);
      }
    }

    // Parse assignedSeats if needed
    let parsedAssignedSeats = [];
    if (assignedSeats) {
      try {
        parsedAssignedSeats = typeof assignedSeats === 'string' 
          ? JSON.parse(assignedSeats) 
          : assignedSeats;
      } catch (e) {
        console.error('Error parsing assignedSeats:', e);
      }
    }

    const user = await User.create({
      name, 
      email, 
      password,
      phone: phone || null,
      address: address || null,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      assignedZone: assignedZone || null,
      assignedSeats: parsedAssignedSeats,
      accessibleSeats: parsedAccessibleSeats,  // ✅ Super Admin ko bhi seat access
      createdBy: req.user ? req.user.id : null
    });

    res.status(201).json({
      success: true,
      message: 'Super Admin created successfully',
      data: { 
        _id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        accessibleSeats: user.accessibleSeats
      }
    });
  } catch (error) {
    console.error('Create super admin error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== READ USERS ====================

const getAllUsers = async (req, res) => {
  try {
    const { role, status } = req.query;
    let filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    
    const users = await User.find(filter).select('-password');
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserStats = async (req, res) => {
  try {
    const stats = {
      totalUsers: await User.countDocuments(),
      superAdmins: await User.countDocuments({ role: 'SUPER_ADMIN' }),
      theaterOwners: await User.countDocuments({ role: 'THEATER_OWNER' }),
      vendors: await User.countDocuments({ role: 'VENDOR' }),
      buyers: await User.countDocuments({ role: 'BUYER' }),
      activeUsers: await User.countDocuments({ status: 'ACTIVE' })
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== UPDATE USERS ====================

const updateUser = async (req, res) => {
  try {
    console.log("Update user request body:", req.body);
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { 
      name, phone, address, role, status, 
      assignedTheater, storeName, isOpen, 
      assignedZone, assignedSeats, accessibleSeats,
      password
    } = req.body;
    
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (role) user.role = role;
    if (status) user.status = status;
    if (assignedTheater) user.assignedTheater = assignedTheater;
    if (storeName) user.storeName = storeName;
    if (isOpen !== undefined) user.isOpen = isOpen;
    if (assignedZone) user.assignedZone = assignedZone;
    if (assignedSeats !== undefined) {
      user.assignedSeats = Array.isArray(assignedSeats) ? assignedSeats : assignedSeats ? JSON.parse(assignedSeats) : [];
    }
    
    // ✅ Update accessibleSeats
    if (accessibleSeats !== undefined) {
      user.accessibleSeats = Array.isArray(accessibleSeats) ? accessibleSeats : accessibleSeats ? JSON.parse(accessibleSeats) : [];
      console.log("Updated accessibleSeats:", user.accessibleSeats);
    }

    // Update password if provided
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
      }
      user.password = password;
    }
    
    await user.save();
    res.json({ success: true, message: 'User updated successfully', data: user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.status = status;
    await user.save();
    res.json({ success: true, message: `User status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addTheaterToOwner = async (req, res) => {
  try {
    const theaterOwner = await User.findById(req.params.theaterOwnerId);
    if (!theaterOwner || theaterOwner.role !== 'THEATER_OWNER') {
      return res.status(404).json({ success: false, message: 'Theater owner not found' });
    }

    const { theaterName, theaterLocation, city, state, pincode, totalScreens, contactNumber } = req.body;
    theaterOwner.theaters.push({
      theaterName, theaterLocation,
      city: city || null, state: state || null,
      pincode: pincode || null,
      totalScreens: totalScreens || 1,
      contactNumber: contactNumber || null,
      status: 'ACTIVE'
    });

    await theaterOwner.save();
    res.json({ success: true, message: 'Theater added successfully', data: theaterOwner.theaters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== DELETE USERS ====================

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }
    await user.deleteOne();
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SEAT ACCESS MANAGEMENT (BUYER & THEATER OWNER) ====================

// @desc    Assign specific seats to buyer
// @route   POST /api/admin/buyer/assign-seats
const assignSeatsToBuyer = async (req, res) => {
  try {
    const { buyerId, theaterId, zoneId, seatNumbers, validUntil } = req.body;

    if (!buyerId || !theaterId || !zoneId || !seatNumbers || seatNumbers.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'buyerId, theaterId, zoneId, and seatNumbers are required' 
      });
    }

    // Validate buyer exists
    const buyer = await User.findOne({ _id: buyerId, role: 'BUYER' });
    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Buyer not found' });
    }

    // Validate theater and get zone details
    const Theater = require('../models/Theater');
    const theater = await Theater.findById(theaterId);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    // Find the zone in screens
    let foundZone = null;
    let foundScreen = null;
    
    for (const screen of theater.screens) {
      const zone = screen.zones?.find(z => z.id === zoneId || z._id.toString() === zoneId);
      if (zone) {
        foundZone = zone;
        foundScreen = screen;
        break;
      }
    }

    if (!foundZone) {
      return res.status(404).json({ 
        success: false, 
        message: 'Zone not found in this theater',
        availableZones: theater.screens.flatMap(s => s.zones?.map(z => ({ id: z.id, name: z.seatType })) || [])
      });
    }

    // Validate each seat exists in this zone
    const validSeats = [];
    const invalidSeats = [];

    for (const seatNum of seatNumbers) {
      let seatExists = false;
      
      for (const row of foundZone.rows) {
        const seat = row.seats?.find(s => s.seatNumber === seatNum);
        if (seat) {
          seatExists = true;
          break;
        }
      }
      
      if (seatExists) {
        validSeats.push(seatNum);
      } else {
        invalidSeats.push(seatNum);
      }
    }

    if (validSeats.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid seats found. Seats must exist in the selected zone.',
        invalidSeats,
        zoneInfo: {
          zoneId: foundZone.id,
          zoneName: foundZone.seatType,
          totalSeatsInZone: foundZone.totalSeats,
          sampleSeats: foundZone.rows.slice(0, 2).flatMap(r => r.seats?.slice(0, 3).map(s => s.seatNumber) || [])
        }
      });
    }

    // Check if buyer already has access for this theater/zone
    const existingAccessIndex = buyer.accessibleSeats?.findIndex(
      access => access.theaterId?.toString() === theaterId && 
                access.zoneId === zoneId
    ) || -1;

    if (existingAccessIndex !== -1 && existingAccessIndex >= 0) {
      // Update existing access - merge seats
      const existingSeats = buyer.accessibleSeats[existingAccessIndex].seatNumbers || [];
      const mergedSeats = [...new Set([...existingSeats, ...validSeats])];
      buyer.accessibleSeats[existingAccessIndex].seatNumbers = mergedSeats;
      buyer.accessibleSeats[existingAccessIndex].assignedBy = req.user.id;
      buyer.accessibleSeats[existingAccessIndex].assignedAt = new Date();
      if (validUntil) buyer.accessibleSeats[existingAccessIndex].validUntil = new Date(validUntil);
      buyer.accessibleSeats[existingAccessIndex].isActive = true;
    } else {
      // Create new access
      if (!buyer.accessibleSeats) buyer.accessibleSeats = [];
      buyer.accessibleSeats.push({
        theaterId,
        zoneId,
        zoneName: foundZone.seatType,
        seatNumbers: validSeats,
        assignedBy: req.user.id,
        assignedAt: new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        isActive: true
      });
    }

    await buyer.save();

    res.json({
      success: true,
      message: `${validSeats.length} seats assigned to ${buyer.name}`,
      data: {
        buyerId: buyer._id,
        buyerName: buyer.name,
        buyerEmail: buyer.email,
        theaterId,
        theaterName: theater.name,
        zoneId: foundZone.id,
        zoneName: foundZone.seatType,
        assignedSeats: validSeats,
        invalidSeats: invalidSeats.length > 0 ? invalidSeats : null,
        totalAssigned: validSeats.length,
        validUntil: validUntil || null
      }
    });
  } catch (error) {
    console.error('Assign seats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get buyer's accessible seats
// @route   GET /api/admin/buyer/accessible-seats/:buyerId
const getBuyerAccessibleSeats = async (req, res) => {
  try {
    const { buyerId } = req.params;
    const { theaterId } = req.query;

    const buyer = await User.findOne({ _id: buyerId, role: 'BUYER' })
      .select('name email accessibleSeats');

    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Buyer not found' });
    }

    let accessibleSeats = buyer.accessibleSeats || [];
    
    // Filter by theater if provided
    if (theaterId) {
      accessibleSeats = accessibleSeats.filter(
        access => access.theaterId?.toString() === theaterId
      );
    }

    // Get theater details for each access
    const Theater = require('../models/Theater');
    const enrichedAccess = await Promise.all(
      accessibleSeats.map(async (access) => {
        const theater = await Theater.findById(access.theaterId).select('name location city screens');
        
        // Get zone details from theater
        let zoneDetails = null;
        if (theater) {
          for (const screen of theater.screens) {
            const zone = screen.zones?.find(z => z.id === access.zoneId);
            if (zone) {
              zoneDetails = {
                id: zone.id,
                seatType: zone.seatType,
                color: zone.color,
                basePrice: zone.basePrice,
                finalPrice: zone.finalPrice,
                totalSeats: zone.totalSeats
              };
              break;
            }
          }
        }
        
        return {
          ...access.toObject(),
          theaterDetails: theater ? {
            _id: theater._id,
            name: theater.name,
            location: theater.location,
            city: theater.city
          } : null,
          zoneDetails,
          isValid: !access.validUntil || new Date() <= new Date(access.validUntil),
          isExpiringSoon: access.validUntil && new Date(access.validUntil) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };
      })
    );

    res.json({
      success: true,
      data: {
        buyer: { _id: buyer._id, name: buyer.name, email: buyer.email },
        accessibleSeats: enrichedAccess,
        totalAccessRecords: enrichedAccess.length
      }
    });
  } catch (error) {
    console.error('Get accessible seats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove seat access from buyer
// @route   DELETE /api/admin/buyer/remove-seat-access/:buyerId/:accessId
const removeBuyerSeatAccess = async (req, res) => {
  try {
    const { buyerId, accessId } = req.params;
    const { seatNumbers } = req.body;

    const buyer = await User.findOne({ _id: buyerId, role: 'BUYER' });
    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Buyer not found' });
    }

    if (!buyer.accessibleSeats || buyer.accessibleSeats.length === 0) {
      return res.status(404).json({ success: false, message: 'No access records found for this buyer' });
    }

    const accessIndex = buyer.accessibleSeats.findIndex(
      access => access._id.toString() === accessId
    );

    if (accessIndex === -1) {
      return res.status(404).json({ success: false, message: 'Access record not found' });
    }

    let message = '';
    
    if (seatNumbers && seatNumbers.length > 0) {
      // Remove specific seats only
      const currentSeats = buyer.accessibleSeats[accessIndex].seatNumbers || [];
      const remainingSeats = currentSeats.filter(seat => !seatNumbers.includes(seat));
      
      if (remainingSeats.length === 0) {
        buyer.accessibleSeats.splice(accessIndex, 1);
        message = `All seats removed. Access record deleted.`;
      } else {
        buyer.accessibleSeats[accessIndex].seatNumbers = remainingSeats;
        message = `${seatNumbers.length} seats removed from buyer's access. ${remainingSeats.length} seats remaining.`;
      }
    } else {
      buyer.accessibleSeats.splice(accessIndex, 1);
      message = 'Seat access removed completely';
    }

    await buyer.save();

    res.json({
      success: true,
      message,
      data: {
        remainingAccessRecords: buyer.accessibleSeats.length,
        accessibleSeats: buyer.accessibleSeats
      }
    });
  } catch (error) {
    console.error('Remove seat access error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ NEW: Theater Owner seat access functions
const assignSeatsToTheaterOwner = async (req, res) => {
  try {
    const { theaterOwnerId, theaterId, zoneId, seatNumbers, validUntil } = req.body;

    if (!theaterOwnerId || !theaterId || !zoneId || !seatNumbers || seatNumbers.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'theaterOwnerId, theaterId, zoneId, and seatNumbers are required' 
      });
    }

    const owner = await User.findOne({ _id: theaterOwnerId, role: 'THEATER_OWNER' });
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Theater owner not found' });
    }

    const Theater = require('../models/Theater');
    const theater = await Theater.findById(theaterId);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }

    let foundZone = null;
    for (const screen of theater.screens) {
      const zone = screen.zones?.find(z => z.id === zoneId || z._id.toString() === zoneId);
      if (zone) {
        foundZone = zone;
        break;
      }
    }

    if (!foundZone) {
      return res.status(404).json({ success: false, message: 'Zone not found' });
    }

    if (!owner.accessibleSeats) owner.accessibleSeats = [];
    owner.accessibleSeats.push({
      theaterId,
      zoneId,
      zoneName: foundZone.seatType,
      seatNumbers,
      assignedBy: req.user.id,
      assignedAt: new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      isActive: true
    });

    await owner.save();

    res.json({
      success: true,
      message: `${seatNumbers.length} seats assigned to theater owner`,
      data: { accessibleSeats: owner.accessibleSeats }
    });
  } catch (error) {
    console.error('Assign seats to theater owner error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserAccessibleSeats = async (req, res) => {
  try {
    const { theaterOwnerId } = req.params;
    const user = await User.findById(theaterOwnerId).select('name email role accessibleSeats');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        user: { _id: user._id, name: user.name, email: user.email, role: user.role },
        accessibleSeats: user.accessibleSeats || []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const removeUserSeatAccess = async (req, res) => {
  try {
    const { theaterOwnerId, accessId } = req.params;
    const user = await User.findById(theaterOwnerId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const accessIndex = user.accessibleSeats?.findIndex(a => a._id.toString() === accessId);
    if (accessIndex === -1 || accessIndex === undefined) {
      return res.status(404).json({ success: false, message: 'Access record not found' });
    }

    user.accessibleSeats.splice(accessIndex, 1);
    await user.save();

    res.json({ success: true, message: 'Seat access removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createScanningUser = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    const user = await User.create({
      name,
      email,
      password,
      phone: phone || null,
      address: address || null,
      role: 'SCANNING_USER',
      status: 'ACTIVE',
      createdBy: req.user ? req.user.id : null
    });
    res.status(201).json({
      success: true,
      message: 'Scanning user created successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Create scanning user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== EXPORT ALL ====================

module.exports = {
  createTheaterOwner,
  createVendor,
  createBuyer,
  createSuperAdmin,
  createScanningUser,
  getAllUsers,
  getUserById,
  getUserStats,
  updateUser,
  updateUserStatus,
  addTheaterToOwner,
  deleteUser,
  // Buyer seat access
  assignSeatsToBuyer,
  getBuyerAccessibleSeats,
  removeBuyerSeatAccess,
  // Theater Owner seat access
  assignSeatsToTheaterOwner,
  getUserAccessibleSeats,
  removeUserSeatAccess
};