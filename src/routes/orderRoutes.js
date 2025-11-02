const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { isAdmin, hasPermission } = require('../middlewares/adminMiddleware');
const orderController = require('../controllers/orderController');
const adminController = require('../controllers/adminController'); // FIX: import

// All order routes require authentication
router.use(protect);

// Create order (user)
router.post('/', orderController.createOrder);

// Admin order routes (note: path becomes /api/orders/orders)
router.get('/orders', isAdmin, hasPermission('manageOrders'), adminController.getAllOrders);
router.get('/orders/:id', isAdmin, hasPermission('manageOrders'), adminController.getOrderById);

// Single status route (remove duplicate)
router.put('/orders/:id/status', isAdmin, hasPermission('manageOrders'), orderController.adminUpdateOrderStatus);

// User order routes
router.get('/', orderController.getUserOrders);
router.get('/:id', orderController.getOrderById);
router.put('/:id/cancel', orderController.cancelOrder);
router.get('/:id/track', orderController.trackOrder);

// Credit wallet for an order (admin/system)
router.post('/:orderId/credit-wallet', isAdmin, hasPermission('manageOrders'), orderController.creditWalletForOrder);

module.exports = router;