const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * @desc    Create a new order
 * @route   POST /api/orders
 * @access  Private (User)
 */
exports.createOrder = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      billingAddress,
      payment,
      notes
    } = req.body;

    // Validate items exist
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items in the order'
      });
    }

    // Validate required fields
    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address is required'
      });
    }

    // Get user details
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate order totals
    let subtotal = 0;
    let orderItems = [];
    
    // Process each item
    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.productId}`
        });
      }
      
      // Check if product is active and in stock
      if (!product.status.active || !product.status.inStock) {
        return res.status(400).json({
          success: false,
          message: `Product "${product.name}" is not available for purchase`
        });
      }
      
      // Check if quantity is available
      if (item.quantity > product.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.quantity}`
        });
      }
      
      // Calculate item price with discount
      let itemPrice = product.price;
      let discountAmount = 0;
      
      if (product.discount && product.discount.regular && product.discount.regular.active) {
        discountAmount = (itemPrice * product.discount.regular.percentage) / 100;
        itemPrice = itemPrice - discountAmount;
      }
      
      // Add item to order
      const orderItem = {
        product: {
          _id: product._id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          image: product.images && product.images.length > 0 ? {
            url: product.images[0].url,
            alt: product.images[0].alt || product.name
          } : null
        },
        quantity: item.quantity,
        price: itemPrice,
        discount: discountAmount,
        totalPrice: itemPrice * item.quantity
      };
      
      orderItems.push(orderItem);
      subtotal += orderItem.totalPrice;
      
      // Update product inventory (decrease quantity)
      product.quantity -= item.quantity;
      await product.save();
    }
    
    // Calculate shipping cost, tax, and total
    // You can customize this based on your business rules
    const shippingCost = 10; // Example flat rate
    const taxRate = 0.07; // Example 7% tax
    const taxAmount = subtotal * taxRate;
    const total = subtotal + shippingCost + taxAmount;
    
    // Create new order
    const order = new Order({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      },
      items: orderItems,
      shippingAddress,
      billingAddress: billingAddress || { sameAsShipping: true, address: shippingAddress },
      payment: {
        ...payment,
        amount: total
      },
      subtotal,
      shippingCost,
      tax: taxAmount,
      total,
      notes
    });
    
    await order.save();
    
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

/**
 * @desc    Get all orders for logged in user
 * @route   GET /api/orders
 * @access  Private (User)
 */
exports.getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      'user._id': req.user.id
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
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
        message: 'Order not found'
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
        message: 'Order not found'
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
      message: 'Order cancelled successfully',
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
        message: 'Order not found'
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