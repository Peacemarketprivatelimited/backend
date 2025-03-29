const User = require('../models/User');
const Product = require('../models/Product');
// const Category = require('../models/Category');
// const Order = require('../models/Order');
// const Subscription = require('../models/Subscription');
// const Withdrawal = require('../models/Withdrawal');
const mongoose = require('mongoose');

// Dashboard stats
// exports.getDashboardStats = async (req, res) => {
//   try {
//     // Get counts of key entities
//     const userCount = await User.countDocuments();
//     const productCount = await Product.countDocuments();
//     const orderCount = await Order.countDocuments();
//     const activeSubscriptions = await User.countDocuments({ 'subscription.isActive': true });
    
//     // Get pending withdrawals
//     const pendingWithdrawals = await User.countDocuments({ 'withdrawals.pendingRequest': true });
    
//     // Get recent orders
//     const recentOrders = await Order.find()
//       .sort({ createdAt: -1 })
//       .limit(5)
//       .populate('user', 'name email');
    
//     // Get top selling products
//     const topProducts = await Product.find()
//       .sort({ sold: -1 })
//       .limit(5);
    
//     // Get revenue stats
//     const totalRevenue = await Order.aggregate([
//       { $match: { status: 'completed' } },
//       { $group: { _id: null, total: { $sum: '$totalAmount' } } }
//     ]);
    
//     // Get subscription revenue
//     const subscriptionRevenue = await User.aggregate([
//       { $match: { 'subscription.isActive': true } },
//       { $group: { _id: null, total: { $sum: '$subscription.amountPaid' } } }
//     ]);
    
//     res.json({
//       success: true,
//       stats: {
//         userCount,
//         productCount,
//         orderCount,
//         activeSubscriptions,
//         pendingWithdrawals,
//         revenue: totalRevenue[0]?.total || 0,
//         subscriptionRevenue: subscriptionRevenue[0]?.total || 0
//       },
//       recentOrders,
//       topProducts
//     });
//   } catch (error) {
//     console.error('Dashboard stats error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching dashboard statistics',
//       error: error.message
//     });
//   }
// };

// USER MANAGEMENT
exports.getAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10,
      search = '',
      sort = 'createdAt',
      order = 'desc',
      subscription = '',
      role = ''
    } = req.query;
    
    // Build query
    const query = {};
    
    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add subscription filter
    if (subscription === 'active') {
      query['subscription.isActive'] = true;
    } else if (subscription === 'inactive') {
      query['subscription.isActive'] = false;
    }
    
    // Add role filter
    if (role) {
      query.role = role;
    }
    
    // Count total documents
    const total = await User.countDocuments(query);
    
    // Get paginated users
    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ [sort]: order === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, email, username } = req.body;
    
    // Find user
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (username) user.username = username;
    
    // Save changes
    await user.save();
    
    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if trying to delete an admin
    if (user.role === 'admin' || user.role === 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete admin users'
      });
    }
    
    await user.remove();
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

exports.changeUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });
  } catch (error) {
    console.error('Change user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing user status',
      error: error.message
    });
  }
};

exports.changeUserRole = async (req, res) => {
  try {
    const { role, permissions } = req.body;
    
    // Validate role
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }
    
    // Only super admin can change roles
    if (req.user.role !== 'superadmin' && role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can promote users to admin'
      });
    }
    
    // Update user
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        role,
        ...(permissions && { permissions })
      },
      { new: true }
    ).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User role updated successfully',
      user
    });
  } catch (error) {
    console.error('Change user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing user role',
      error: error.message
    });
  }
};

// PRODUCT MANAGEMENT
// exports.getAllProducts = async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 10,
//       search = '',
//       category = '',
//       sort = 'createdAt',
//       order = 'desc',
//       status = ''
//     } = req.query;
    
//     // Build query
//     const query = {};
    
//     // Add search filter
//     if (search) {
//       query.$or = [
//         { name: { $regex: search, $options: 'i' } },
//         { description: { $regex: search, $options: 'i' } }
//       ];
//     }
    
//     // Add category filter
//     if (category) {
//       query['category._id'] = category;
//     }
    
//     // Add status filter
//     if (status === 'active') {
//       query['status.active'] = true;
//     } else if (status === 'inactive') {
//       query['status.active'] = false;
//     } else if (status === 'instock') {
//       query['status.inStock'] = true;
//     } else if (status === 'outofstock') {
//       query['status.inStock'] = false;
//     }
    
//     // Count total documents
//     const total = await Product.countDocuments(query);
    
//     // Get paginated products
//     const products = await Product.find(query)
//       .sort({ [sort]: order === 'desc' ? -1 : 1 })
//       .skip((page - 1) * limit)
//       .limit(parseInt(limit));
    
//     res.json({
//       success: true,
//       products,
//       pagination: {
//         total,
//         page: parseInt(page),
//         limit: parseInt(limit),
//         pages: Math.ceil(total / limit)
//       }
//     });
//   } catch (error) {
//     console.error('Get all products error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching products',
//       error: error.message
//     });
//   }
// };

// Implement other controller methods for products, orders, etc.
// ...

// WITHDRAWAL MANAGEMENT
// exports.getPendingWithdrawals = async (req, res) => {
//   try {
//     // Find users with pending withdrawal requests
//     const usersWithPendingWithdrawals = await User.find({
//       'withdrawals.pendingRequest': true
//     }).select('name email username withdrawals referral.totalEarnings');
    
//     res.json({
//       success: true,
//       withdrawals: usersWithPendingWithdrawals
//     });
//   } catch (error) {
//     console.error('Get pending withdrawals error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching pending withdrawals',
//       error: error.message
//     });
//   }
// };

// exports.approveWithdrawal = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
  
//   try {
//     const userId = req.params.id;
//     const { amount, transactionDetails } = req.body;
    
//     // Find user
//     const user = await User.findById(userId).session(session);
    
//     if (!user) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }
    
//     // Check if user has a pending withdrawal
//     if (!user.withdrawals.pendingRequest) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         success: false,
//         message: 'No pending withdrawal request found'
//       });
//     }
    
//     // Check if user has enough balance
//     if (user.referral.totalEarnings < amount) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         success: false,
//         message: 'Insufficient balance'
//       });
//     }
    
//     // Process withdrawal
//     user.referral.totalEarnings -= amount;
//     user.withdrawals.pendingRequest = false;
//     user.withdrawals.lastWithdrawalDate = new Date();
//     user.withdrawals.totalWithdrawn += amount;
    
//     // Save withdrawal transaction record
//     // (Create a withdrawal model if you need to track these details)
    
//     // Save changes
//     await user.save({ session });
    
//     // Commit transaction
//     await session.commitTransaction();
//     session.endSession();
    
//     res.json({
//       success: true,
//       message: 'Withdrawal approved successfully',
//       withdrawal: {
//         userId: user._id,
//         amount,
//         date: new Date(),
//         bankDetails: user.withdrawals.bankAccount
//       }
//     });
//   } catch (error) {
//     // Abort transaction on error
//     await session.abortTransaction();
//     session.endSession();
    
//     console.error('Approve withdrawal error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error approving withdrawal',
//       error: error.message
//     });
//   }
// };

// exports.rejectWithdrawal = async (req, res) => {
//   try {
//     const userId = req.params.id;
//     const { reason } = req.body;
    
//     // Find user
//     const user = await User.findById(userId);
    
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }
    
//     // Check if user has a pending withdrawal
//     if (!user.withdrawals.pendingRequest) {
//       return res.status(400).json({
//         success: false,
//         message: 'No pending withdrawal request found'
//       });
//     }
    
//     // Reset pending request
//     user.withdrawals.pendingRequest = false;
    
//     // Save changes
//     await user.save();
    
//     res.json({
//       success: true,
//       message: 'Withdrawal rejected successfully'
//     });
//   } catch (error) {
//     console.error('Reject withdrawal error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error rejecting withdrawal',
//       error: error.message
//     });
//   }
// };

// REPORTS
// exports.getSalesReport = async (req, res) => {
//   try {
//     const { startDate, endDate } = req.query;
    
//     // Build date range filter
//     const dateFilter = {};
//     if (startDate) {
//       dateFilter.createdAt = { $gte: new Date(startDate) };
//     }
//     if (endDate) {
//       if (dateFilter.createdAt) {
//         dateFilter.createdAt.$lte = new Date(endDate);
//       } else {
//         dateFilter.createdAt = { $lte: new Date(endDate) };
//       }
//     }
    
//     // Get sales data
//     const salesData = await Order.aggregate([
//       { $match: { ...dateFilter, status: 'completed' } },
//       { $group: {
//         _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
//         sales: { $sum: '$totalAmount' },
//         count: { $sum: 1 }
//       }},
//       { $sort: { _id: 1 } }
//     ]);
    
//     // Get total stats
//     const totalStats = await Order.aggregate([
//       { $match: { ...dateFilter, status: 'completed' } },
//       { $group: {
//         _id: null,
//         totalSales: { $sum: '$totalAmount' },
//         totalOrders: { $sum: 1 },
//         avgOrderValue: { $avg: '$totalAmount' }
//       }}
//     ]);
    
//     res.json({
//       success: true,
//       salesData,
//       totalStats: totalStats[0] || { totalSales: 0, totalOrders: 0, avgOrderValue: 0 }
//     });
//   } catch (error) {
//     console.error('Sales report error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error generating sales report',
//       error: error.message
//     });
//   }
// };

// Implement other report controllers...