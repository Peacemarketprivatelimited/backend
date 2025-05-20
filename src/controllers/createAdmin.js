const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Function to create super admin
async function createSuperAdmin() {
  try {
    // Connect to database
    await mongoose.connect("mongodb+srv://fa22bse121:2AtT8vL1Ci63C92O@cluster0.ed7ec.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0t");
    console.log('Connected to MongoDB');
    
    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ role: 'superadmin' });
    
    if (existingSuperAdmin) {
      console.log('Super admin already exists');
      process.exit(0);
    }
    
    // Create super admin
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD || 'superadmin123', salt);
    
    const superAdmin = new User({
      name: 'Super Admin',
      username: 'superadmin',
      email: process.env.SUPER_ADMIN_EMAIL || 'admin@peacemarket.com',
      passwordHash,
      role: 'superadmin',
      permissions: {
        manageUsers: true,
        manageProducts: true,
        manageCategories: true,
        manageOrders: true,
        manageSubscriptions: true,
        manageWithdrawals: true,
        viewReports: true,
        viewDashboard: true
      }
    });
    
    await superAdmin.save();
    
    console.log('Super admin created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating super admin:', error);
    process.exit(1);
  }
}

// Run the function
createSuperAdmin();