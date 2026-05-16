const User = require('../models/User');


const createTheaterOwner = async (req, res) => {
  try {
    const { name, email, password, phone, address, theaters } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({
      name, email, password,
      phone: phone || null,
      address: address || null,
      role: 'THEATER_OWNER',
      status: 'ACTIVE',
      theaters: theaters || [],
      createdBy: req.user ? req.user.id : null
    });

    res.status(201).json({
      success: true,
      message: 'Theater Owner created successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        theaters: user.theaters
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createVendor = async (req, res) => {
  try {
    const { 
      name, email, password, phone, address, 
      vendorType, assignedTheater, storeName, storeLocation, 
      gstNumber, foodLicenseNumber, deliveryTime 
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
        assignedTheater: user.assignedTheater
      }
    });
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
const createBuyer = async (req, res) => {
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
      name, email, password,
      phone: phone || null,
      address: address || null,
      role: 'BUYER',
      status: 'ACTIVE',
      createdBy: req.user ? req.user.id : null
    });

    res.status(201).json({
      success: true,
      message: 'Buyer created successfully',
      data: { _id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createSuperAdmin = async (req, res) => {
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
      name, email, password,
      phone: phone || null,
      address: address || null,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      createdBy: req.user ? req.user.id : null
    });

    res.status(201).json({
      success: true,
      message: 'Super Admin created successfully',
      data: { _id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
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
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { name, phone, address, role, status, assignedTheater, storeName, isOpen } = req.body;
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (role) user.role = role;
    if (status) user.status = status;
    if (assignedTheater) user.assignedTheater = assignedTheater;
    if (storeName) user.storeName = storeName;
    if (isOpen !== undefined) user.isOpen = isOpen;

    await user.save();
    res.json({ success: true, message: 'User updated successfully', data: user });
  } catch (error) {
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

// ==================== EXPORT ALL ====================

module.exports = {
  createTheaterOwner,
  createVendor,
  createBuyer,
  createSuperAdmin,
  getAllUsers,
  getUserById,
  getUserStats,
  updateUser,
  updateUserStatus,
  addTheaterToOwner,
  deleteUser
};