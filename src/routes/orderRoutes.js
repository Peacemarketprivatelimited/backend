const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect } = require('../middlewares/authMiddleware');
const { hasPermission } = require('../middlewares/adminMiddleware');
const adminController = require('../controllers/adminController');

// All order routes require authentication
router.use(protect);

// User order routes
router.post('/', orderController.createOrder);
router.get('/', orderController.getUserOrders);
router.get('/:id', orderController.getOrderById);
router.put('/:id/cancel', orderController.cancelOrder);
router.get('/:id/track', orderController.trackOrder);

// Order management (uncomment these)
router.get('/orders', hasPermission('manageOrders'), adminController.getAllOrders);
router.get('/orders/:id', hasPermission('manageOrders'), adminController.getOrderById);
router.put('/orders/:id/status', hasPermission('manageOrders'), adminController.updateOrderStatus);

// Reports (uncomment this)
router.get('/reports/sales', hasPermission('viewReports'), adminController.getSalesReport);

module.exports = router;