const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// Helper: is the subscription discount active for a product?
function getSubscriptionDiscountPct(product) {
  try {
    if (!product?.discount?.subscription?.active) return 0;
    const pct = Number(product.discount.subscription.percentage || 0);
    if (pct <= 0) return 0;
    return Math.min(Math.max(pct, 0), 100);
  } catch {
    return 0;
  }
}

// Create order (full price charged; store walletCredit amount)
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      items,
      shipping = 0,
      tax = 0,
      payment,
      billingAddress,
      shippingAddress,
      status = 'pending',
      phoneNumber
    } = req.body;

    // Validate required fields (add more as needed)
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided' });
    }

    let orderItems = [];
    let subtotal = 0;
    let walletCreditTotal = 0;

    for (const line of items) {
      // Frontend must send: actualPrice, discountedPrice, quantity, productId, name
      const actualPrice = Number(line.actualPrice);
      const discountedPrice = Number(line.discountedPrice);
      const discount = actualPrice - discountedPrice;
      const qty = Number(line.quantity);

      orderItems.push({
        product: line.productId,
        name: line.name || '',
        actualPrice,
        discountedPrice,
        discount,
        quantity: qty
      });

      subtotal += discountedPrice * qty;
      walletCreditTotal += discount * qty;
    }

    const shippingNum = Number(shipping);
    const taxNum = Number(tax);
    const total = subtotal + shippingNum + taxNum;

    const finalOrderNumber = generateOrderNumber();

    const order = await Order.create({
      user: userId,
      items: orderItems,
      orderNumber: finalOrderNumber,
      shippingAddress,
      billingAddress,
      payment,
      subtotal,
      shipping: shippingNum,
      tax: taxNum,
      total,
      status,
      phoneNumber,
      walletCredit: {
        amount: walletCreditTotal,
        credited: false
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Order created',
      order
    });
  } catch (error) {
    console.error('createOrder error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create order', error: error.message });
  }
};

/**
 * @desc    Get all orders for logged in user
 * @route   GET /api/orders
 * @access  Private (User)
 */
exports.getUserOrders = async (req, res) => {
  const userId = req.user.id;
  try {
    const orders = await Order.find({
      'user._id': userId
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

/**
 * @desc    Get order by ID
 * @route   GET /api/orders/:id
 * @access  Private (User)
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
    
    // Only allow users to access their own orders
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
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
 * @desc    Cancel an order
 * @route   PUT /api/orders/:id/cancel
 * @access  Private (User)
 */
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orders not found'
      });
    }
    
    // Only allow users to cancel their own orders
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }
    
    // Only allow cancellation of pending or processing orders
    if (order.status !== 'pending' && order.status !== 'processing') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status "${order.status}"`
      });
    }
    
    // Update order status and set cancelled date
    order.status = 'cancelled';
    order.cancelledAt = Date.now();
    
    await order.save();
    
    // Return items to inventory
    for (const item of order.items) {
      const product = await Product.findById(item.product._id);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }
    
    res.json({
      success: true,
      message: 'Orders cancelled successfully',
      order
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  }
};

/**
 * @desc    Track an order status
 * @route   GET /api/orders/:id/track
 * @access  Private (User)
 */
exports.trackOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      'user._id': req.user.id
    }).select('orderNumber status trackingNumber trackingUrl shippedAt deliveredAt createdAt');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orders not found'
      });
    }
    
    res.json({
      success: true,
      tracking: {
        orderNumber: order.orderNumber,
        status: order.status,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
        orderedAt: order.createdAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt
      }
    });
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track order',
      error: error.message
    });
  }
};


/**
 * @desc    Update order status (admin or authorized user)
 * @route   PUT /api/orders/:id/status
 * @access  Private (Admin or User with permission)
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing status value'
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orders not found'
      });
    }

    order.status = status;
    await order.save();

    res.json({
      success: true,
      message: `Order status updated to "${status}"`,
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
 * @desc    Get the status of an order
 * @route   GET /api/orders/:id/status
 * @access  Private (User or Admin)
 */
exports.getOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).select('orderNumber status');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orders not found'
      });
    }

    res.json({
      success: true,
      orderNumber: order.orderNumber,
      status: order.status
    });
  } catch (error) {
    console.error('Error getting order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get order status',
      error: error.message
    });
  }
};

/**
 * @desc    Update order status by admin
 * @route   PUT /api/orders/:id/status
 * @access  Private (Admin)
 */
exports.adminUpdateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing status value'
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orders not found'
      });
    }

    order.status = status;
    await order.save();

    res.json({
      success: true,
      message: `Order status updated to "${status}" by admin`,
      order
    });
  } catch (error) {
    console.error('Error updating order status by admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status by admin',
      error: error.message
    });
  }
};

/**
 * @desc    Credit wallet for order (admin only)
 * @route   POST /api/orders/:orderId/credit-wallet
 * @access  Private (Admin)
 */
exports.creditWalletForOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    let creditedAmount = 0;

    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    // Idempotent: already credited
    if (order.walletCredit && order.walletCredit.credited) {
      creditedAmount = Number(order.walletCredit.amount || 0);
      return res.status(200).json({
        success: true,
        message: 'Wallet already credited',
        orderId,
        amount: creditedAmount,
        walletCredit: order.walletCredit
      });
    }

    // Only allow crediting after delivery (admin approves post-delivery)
    if (order.status !== 'delivered') {
      throw new Error('Order must be delivered before wallet credit can be approved');
    }

    // Calculate amount
    const amount = Number(order.walletCredit?.amount || 0);
    creditedAmount = amount;

    // If nothing to credit, still mark credited to avoid future attempts
    if (amount <= 0) {
      order.walletCredit = order.walletCredit || {};
      order.walletCredit.credited = true;
      order.walletCredit.creditedAt = new Date();
      await order.save();
      return res.status(200).json({
        success: true,
        message: 'No wallet credit to apply',
        orderId,
        amount: 0,
        walletCredit: order.walletCredit
      });
    }

    // Increment user's wallet (using referral.totalEarnings per spec)
    const user = await User.findById(order.user).select('_id referral.totalEarnings');
    if (!user) throw new Error('User not found for order');

    await User.updateOne(
      { _id: user._id },
      {
        $inc: {
          'referral.totalEarnings': amount,
          'referral.earningsByLevel.level1': amount // optional audit increment
        }
      }
    );

    // Mark order credited
    order.walletCredit = order.walletCredit || {};
    order.walletCredit.credited = true;
    order.walletCredit.creditedAt = new Date();
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Wallet credited',
      orderId,
      amount: creditedAmount,
      walletCredit: order.walletCredit
    });
  } catch (error) {
    console.error('creditWalletForOrder error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Deliver order and credit wallet (if applicable)
 * @route   POST /api/orders/:orderId/deliver-credit
 * @access  Private (Admin)
 */
exports.deliverAndCreditWallet = async (req, res) => {
  try {
    const { orderId } = req.params;
    let creditedAmount = 0;

    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    if (order.status !== 'delivered') {
      order.status = 'delivered';
      order.deliveredAt = new Date();
      await order.save();
    }

    const userId = order.user._id || order.user;
    const user = await User.findById(userId).select('subscription referral.totalEarnings');
    if (!user) throw new Error('User not found for order');

    // Credit wallet only if not already credited
    if (order.walletCredit && !order.walletCredit.credited) {
      const amount = Number(order.walletCredit.amount || 0);
      creditedAmount = amount;

      if (amount > 0) {
        await User.updateOne(
          { _id: user._id },
          {
            $inc: {
              'referral.totalEarnings': amount,
              'referral.earningsByLevel.level1': amount
            }
          }
        );
      }

      order.walletCredit.credited = true;
      order.walletCredit.creditedAt = new Date();
      await order.save();
    }

    const updatedOrder = await Order.findById(orderId).select('status walletCredit deliveredAt');
    return res.status(200).json({
      success: true,
      message: updatedOrder.walletCredit.credited
        ? 'Order delivered and wallet credited'
        : 'Order delivered (no wallet credit: already credited)',
      orderId,
      status: updatedOrder.status,
      deliveredAt: updatedOrder.deliveredAt,
      walletCredit: updatedOrder.walletCredit,
      creditedAmount: updatedOrder.walletCredit.amount
    });
  } catch (error) {
    console.error('deliverAndCreditWallet error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

function generateOrderNumber() {
  // Example: ORD20250729-123456 (ORD + YYYYMMDD + random 6 digits)
  const now = new Date();
  const datePart = now.toISOString().slice(0,10).replace(/-/g, '');
  const randPart = Math.floor(100000 + Math.random() * 900000);
  return `ORD${datePart}-${randPart}`;
}