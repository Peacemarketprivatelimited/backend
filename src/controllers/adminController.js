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


// ...existing code...
// ...existing code...
exports.getAllWithdrawals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,            // optional: pending | approved | rejected
      userSearch,        // optional: name/email/username fuzzy
      sort = 'requestedAt',
      order = 'desc'
    } = req.query;

    const pageNum = parseInt(page);
    const lim = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * lim;

    // Base match: only users having at least one history entry
    const baseMatch = { 'withdrawals.history.0': { $exists: true } };

    // Apply user search
    if (userSearch) {
      baseMatch.$or = [
        { name: { $regex: userSearch, $options: 'i' } },
        { email: { $regex: userSearch, $options: 'i' } },
        { username: { $regex: userSearch, $options: 'i' } }
      ];
    }

    const pipeline = [
      { $match: baseMatch },
      { $unwind: '$withdrawals.history' },
      // Filter by withdrawal status if provided
      ...(status ? [{ $match: { 'withdrawals.history.status': status } }] : []),
      {
        $project: {
          _id: 0,
          userId: '$_id',
            name: 1,
            username: 1,
            email: 1,
            bankAccount: '$withdrawals.bankAccount',
            status: '$withdrawals.history.status',
            requestedAt: '$withdrawals.history.requestedAt',
            processedAt: '$withdrawals.history.processedAt',
            amountRequested: '$withdrawals.history.amountRequested',
            amountPaid: '$withdrawals.history.amountPaid',
            adminNote: '$withdrawals.history.adminNote'
        }
      },
      {
        $sort: {
          [sort]: order === 'asc' ? 1 : -1,
          // tie-breaker
          userId: 1
        }
      },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: lim }],
          total: [{ $count: 'count' }]
        }
      }
    ];

    const agg = await User.aggregate(pipeline);
    const data = agg[0].data;
    const total = agg[0].total[0] ? agg[0].total[0].count : 0;

    res.json({
      success: true,
      withdrawals: data,
      pagination: {
        total,
        page: pageNum,
        limit: lim,
        pages: Math.ceil(total / lim)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawals',
      error: error.message
    });
  }
};
// ...existing code...

exports.approveWithdrawal = async (req, res) => {
  try {
    const { userId, historyId, requestedAt, adminNote } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const findMatch = (w) => {
      if (w.status !== 'pending') return false;
      if (historyId) return String(w._id) === String(historyId);
      if (requestedAt) return w.requestedAt.getTime() === new Date(requestedAt).getTime();
      return false;
    };

    const withdrawal = user.withdrawals.history.find(findMatch);
    if (!withdrawal) return res.status(404).json({ success: false, message: "Withdrawal not found" });

    withdrawal.status = 'approved';
    withdrawal.processedAt = new Date();
    withdrawal.adminNote = adminNote || '';
    user.withdrawals.pendingRequest = false;
    user.withdrawals.lastWithdrawalDate = new Date();
    user.withdrawals.totalWithdrawn = (user.withdrawals.totalWithdrawn || 0) + Number(withdrawal.amountPaid || 0);

    // Reset earnings after paying out
    user.referral.totalEarnings = 0;

    await user.save();
    res.json({ success: true, message: "Withdrawal approved", withdrawal });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to approve withdrawal", error: error.message });
  }
};

exports.rejectWithdrawal = async (req, res) => {
  try {
    const { userId, historyId, requestedAt, adminNote } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const findMatch = (w) => {
      if (w.status !== 'pending') return false;
      if (historyId) return String(w._id) === String(historyId);
      if (requestedAt) return w.requestedAt.getTime() === new Date(requestedAt).getTime();
      return false;
    };

    const withdrawal = user.withdrawals.history.find(findMatch);
    if (!withdrawal) return res.status(404).json({ success: false, message: "Withdrawal not found" });

    withdrawal.status = 'rejected';
    withdrawal.processedAt = new Date();
    withdrawal.adminNote = adminNote || '';
    user.withdrawals.pendingRequest = false;

    await user.save();
    res.json({ success: true, message: "Withdrawal rejected", withdrawal });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to reject withdrawal", error: error.message });
  }
};