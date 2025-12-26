const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const mongoose = require('mongoose');

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

// exports.deleteUser = async (req, res) => {
//   try {
//     const user = await User.findById(req.params.id);

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }

//     // Check if trying to delete an admin
//     if (user.role === 'admin' || user.role === 'superadmin') {
//       return res.status(403).json({
//         success: false,
//         message: 'Cannot delete admin users'
//       });
//     }

//     await user.remove();

//     res.json({
//       success: true,
//       message: 'User deleted successfully'
//     });
//   } catch (error) {
//     console.error('Delete user error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error deleting user',
//       error: error.message
//     });
//   }
// };
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

    // Change this line from user.remove() to:
    await User.deleteOne({ _id: req.params.id });

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

// ORDER MANAGEMENT

/**
 * @desc    Get all orders (admin)
 * @route   GET /api/admin/orders
 * @access  Private (Admin)
 */
// exports.getAllOrders = async (req, res) => {
//   try {
//     const { status, page = 1, limit = 20, sort = 'createdAt', order = 'desc' } = req.query;

//     // Build query
//     const query = {};
//     if (status) {
//       query.status = status;
//     }

//     // Build sort object
//     const sortObj = {};
//     sortObj[sort] = order === 'desc' ? -1 : 1;

//     // Count total documents
//     const total = await Orders.countDocuments(query);

//     // Calculate pagination
//     const skip = (Number(page) - 1) * Number(limit);

//     // Get orders
//     const orders = await Orders.find(query)
//       .sort(sortObj)
//       .skip(skip)
//       .limit(Number(limit));

//     res.json({
//       success: true,
//       count: orders.length,
//       total,
//       pages: Math.ceil(total / Number(limit)),
//       currentPage: Number(page),
//       orders
//     });
//   } catch (error) {
//     console.error('Error fetching all orders:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch orders',
//       error: error.message
//     });
//   }
// };
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};
/**
 * @desc    Get order by ID (admin)
 * @route   GET /api/admin/orders/:id
 * @access  Private (Admin)
 */
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orders not found'
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
};

/**
 * @desc    Update order status (admin)
 * @route   PUT /api/admin/orders/:id/status
 * @access  Private (Admin)
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber, trackingUrl, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orders not found'
      });
    }

    // Update order
    order.status = status;

    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    }

    if (trackingUrl) {
      order.trackingUrl = trackingUrl;
    }

    if (notes) {
      order.notes = notes;
    }

    // Set status-specific dates
    if (status === 'shipped' && !order.shippedAt) {
      order.shippedAt = Date.now();
    }

    if (status === 'delivered' && !order.deliveredAt) {
      order.deliveredAt = Date.now();
    }

    if (status === 'cancelled' && !order.cancelledAt) {
      order.cancelledAt = Date.now();

      // Return items to inventory
      for (const item of order.items) {
        const product = await Product.findById(item.product._id);
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        }
      }
    }

    if (status === 'refunded' && !order.refundedAt) {
      order.refundedAt = Date.now();
    }

    await order.save();

    res.json({
      success: true,
      message: 'Orders status updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
};

/**
 * @desc    Get sales report (admin)
 * @route   GET /api/admin/reports/sales
 * @access  Private (Admin)
 */
exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateQuery = {};

    if (startDate && endDate) {
      dateQuery = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    // Get total sales
    const totalSales = await Order.aggregate([
      { $match: { ...dateQuery, status: { $nin: ['cancelled', 'refunded'] } } },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get sales by day
    const dailySales = await Order.aggregate([
      { $match: { ...dateQuery, status: { $nin: ['cancelled', 'refunded'] } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          sales: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get sales by status
    const salesByStatus = await Order.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      totalSales: totalSales[0] ? totalSales[0].total : 0,
      orderCount: totalSales[0] ? totalSales[0].count : 0,
      dailySales,
      salesByStatus
    });
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate sales report',
      error: error.message
    });
  }
};

// Get all withdrawal requests
exports.getAllWithdrawals = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Find users with pending withdrawal requests
    const usersWithWithdrawals = await User.find({
      'withdrawals.pendingRequest': true
    }).select('name username email withdrawals.totalWithdrawn withdrawals.bankAccount withdrawals.requestedAt withdrawals.amount withdrawals.status referral.totalEarnings').skip(skip).limit(limit);

    // Count total withdrawal requests
    const total = await User.countDocuments({
      'withdrawals.pendingRequest': true
    });

    // Format the withdrawals for admin panel
    const withdrawals = usersWithWithdrawals.map(user => ({
      userId: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      amountPaid: user.withdrawals.amount || user.referral.totalEarnings,
      requestedAt: user.withdrawals.requestedAt || new Date(),
      bankAccount: user.withdrawals.bankAccount ? 
        `${user.withdrawals.bankAccount.bankName} - ${user.withdrawals.bankAccount.accountNumber} (${user.withdrawals.bankAccount.accountHolder})` 
        : 'No bank details provided',
      status: user.withdrawals.status || 'pending'
    }));

    res.json({
      success: true,
      withdrawals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting withdrawals:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving withdrawal requests',
      error: error.message
    });
  }
};

// Approve a withdrawal request
exports.approveWithdrawal = async (req, res) => {
  try {
    const { userId, adminNote } = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (!user.withdrawals.pendingRequest) {
      return res.status(400).json({
        success: false,
        message: 'No pending withdrawal request found'
      });
    }
    
    // Update user document
    user.withdrawals.pendingRequest = false;
    user.withdrawals.totalWithdrawn += user.referral.totalEarnings;
    user.withdrawals.history = user.withdrawals.history || [];
    
    // Add to history
    user.withdrawals.history.push({
      amount: user.referral.totalEarnings,
      status: 'approved',
      requestedAt: user.withdrawals.requestedAt || new Date(),
      processedAt: new Date(),
      adminNote: adminNote || ''
    });
    
    // Reset earnings after withdrawal
    user.referral.totalEarnings = 0;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Withdrawal request approved successfully'
    });
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing withdrawal approval',
      error: error.message
    });
  }
};

// Reject a withdrawal request
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { userId, adminNote } = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (!user.withdrawals.pendingRequest) {
      return res.status(400).json({
        success: false,
        message: 'No pending withdrawal request found'
      });
    }
    
    // Update user document
    user.withdrawals.pendingRequest = false;
    user.withdrawals.history = user.withdrawals.history || [];
    
    // Add to history
    user.withdrawals.history.push({
      amount: user.referral.totalEarnings,
      status: 'rejected',
      requestedAt: user.withdrawals.requestedAt || new Date(),
      processedAt: new Date(),
      adminNote: adminNote || ''
    });
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Withdrawal request rejected successfully'
    });
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing withdrawal rejection',
      error: error.message
    });
  }
};

// Analytics: count of subscribed users
exports.subscriptionsCount = async (req, res) => {
  try {
    const now = new Date();
    const count = await User.countDocuments({ 'subscription.isActive': true, 'subscription.expiryDate': { $gt: now } });
    res.json({ success: true, subscribedUsers: count });
  } catch (error) {
    console.error('Error getting subscriptions count:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Analytics: challenge summary
exports.challengeSummary = async (req, res) => {
  try {
    const ChallengeEvent = require('../models/ChallengeEvent');
    const now = new Date();

    // total points awarded from events
    const totalPointsAgg = await ChallengeEvent.aggregate([
      { $group: { _id: null, totalPoints: { $sum: '$points' }, totalClaims: { $sum: 1 } } }
    ]);

    // distribution of users by their currentDay
    const byDay = await User.aggregate([
      { $group: { _id: '$challenge.currentDay', users: { $sum: 1 }, avgPoints: { $avg: '$challenge.totalChallengePoints' } } },
      { $sort: { _id: 1 } }
    ]);

    // daily claim counts (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyClaims = await ChallengeEvent.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, claims: { $sum: 1 }, points: { $sum: '$points' } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      totalPointsAwarded: totalPointsAgg[0] ? totalPointsAgg[0].totalPoints : 0,
      totalClaims: totalPointsAgg[0] ? totalPointsAgg[0].totalClaims : 0,
      byDay,
      dailyClaims
    });
  } catch (error) {
    console.error('Error getting challenge summary:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Tasks analytics summary
exports.tasksSummary = async (req, res) => {
  try {
    const Task = require('../models/Task');
    const TaskSubmission = require('../models/TaskSubmission');
    const now = new Date();

    const totalTasks = await Task.countDocuments();
    const activeTasks = await Task.countDocuments({ isActive: true, $or: [{ expiryDate: { $exists: false } }, { expiryDate: { $gt: now } }] });

    const totalSubmissionsAgg = await TaskSubmission.aggregate([
      { $group: { _id: null, totalSubmissions: { $sum: 1 }, totalPoints: { $sum: '$pointsAwarded' } } }
    ]);

    const topTasks = await TaskSubmission.aggregate([
      { $group: { _id: '$task', completions: { $sum: 1 }, points: { $sum: '$pointsAwarded' } } },
      { $sort: { completions: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'tasks', localField: '_id', foreignField: '_id', as: 'task' } },
      { $unwind: '$task' },
      { $project: { task: 1, completions: 1, points: 1 } }
    ]);

    res.json({
      success: true,
      totalTasks,
      activeTasks,
      totalSubmissions: (totalSubmissionsAgg[0] && totalSubmissionsAgg[0].totalSubmissions) || 0,
      totalPointsAwarded: (totalSubmissionsAgg[0] && totalSubmissionsAgg[0].totalPoints) || 0,
      topTasks
    });
  } catch (error) {
    console.error('Error getting tasks summary:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};