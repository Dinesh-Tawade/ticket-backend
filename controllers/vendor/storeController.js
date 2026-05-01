const Store = require('../../models/Store');
const fs = require('fs');

// Helper to delete old image
const deleteOldImage = (imagePath) => {
  if (imagePath && fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
};

// @desc    Create or update store
// @route   POST /api/vendor/store/create
const createOrUpdateStore = async (req, res) => {
  try {
    console.log("USER:", req.user);
    console.log("BODY:", req.body);

    let store = await Store.findOne({ vendorId: req.user.id });

    console.log("FOUND STORE:", store);

    const {
      storeName, description, contactNumber, address,
      assignedTheater, gstNumber, fssaiLicense,
      openingTime, closingTime, isOpen
    } = req.body;

    if (store) {
      console.log("Updating store...");

      Object.assign(store, {
        storeName,
        description,
        contactNumber,
        address,
        assignedTheater,
        gstNumber,
        fssaiLicense,
        openingTime,
        closingTime,
        isOpen
      });

      await store.save();

      console.log("UPDATED STORE:", store);

      return res.json({
        success: true,
        message: 'Store updated successfully',
        data: store
      });
    } else {
      console.log("Creating store...");

      const newStore = await Store.create({
        vendorId: req.user.id,
        storeName,
        description,
        contactNumber,
        address,
        assignedTheater,
        gstNumber,
        fssaiLicense,
        openingTime,
        closingTime,
        isOpen: isOpen ?? true,
        status: 'ACTIVE'
      });

      console.log("CREATED STORE:", newStore);

      return res.status(201).json({
        success: true,
        message: 'Store created successfully',
        data: newStore
      });
    }

  } catch (error) {
    console.error("FULL ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my store
// @route   GET /api/vendor/store
const getMyStore = async (req, res) => {
  try {
    const store = await Store.findOne({ vendorId: req.user.id })
      .populate('assignedTheater', 'name location city');
    
    if (!store) {
      return res.status(404).json({ 
        success: false, 
        message: 'Store not found. Please create your store first.' 
      });
    }

    res.json({ success: true, data: store });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle store open/close
// @route   PUT /api/vendor/store/toggle-status
const toggleStoreStatus = async (req, res) => {
  try {
    const store = await Store.findOne({ vendorId: req.user.id });
    
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    store.isOpen = !store.isOpen;
    await store.save();

    res.json({
      success: true,
      message: `Store is now ${store.isOpen ? 'OPEN' : 'CLOSED'}`,
      data: { isOpen: store.isOpen }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createOrUpdateStore,
  getMyStore,
  toggleStoreStatus
};