const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const connectDB = require('./config/db');
const { encrypt } = require('./utils/encryption');

dotenv.config();
connectDB();

const createSuperAdmin = async () => {
  try {
    // Check if super admin already exists
    const existingAdmin = await User.findOne({ role: 'SUPER_ADMIN' });
    
    if (existingAdmin) {
      console.log('⚠️ Super Admin already exists:');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Name: ${existingAdmin.name}`);
      process.exit(0);
      return;
    }

    // Create super admin with encrypted fields
    const superAdmin = await User.create({
      name: 'Super Admin',      // Mongoose schema auto-encrypt karega
      email: 'superadmin@bookingapp.com',
      password: 'SuperAdmin123!',
      phone: '9999999999',
      address: 'Admin Office',
      role: 'SUPER_ADMIN',
      status: 'APPROVED',
      profileImage: null
    });

    console.log('✅ Super Admin created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email: superadmin@bookingapp.com');
    console.log('🔑 Password: SuperAdmin123!');
    console.log('👤 Name: Super Admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('❌ Error creating super admin:', error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach(key => {
        console.error(`   ${key}: ${error.errors[key].message}`);
      });
    }
  } finally {
    mongoose.disconnect();
  }
};

createSuperAdmin();