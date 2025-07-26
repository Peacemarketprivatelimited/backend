const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect } = require('../middlewares/authMiddleware');
const { hasPermission } = require('../middlewares/adminMiddleware');
const adminController = require('../controllers/adminController');

router.post('/',protect, orderController.createOrder);
// All order routes require authentication
router.use(protect);
router.get('/orders', hasPermission('manageOrders'), adminController.getAllOrders);


// User order routes
router.get('/', orderController.getUserOrders);
router.get('/:id', orderController.getOrderById);
router.put('/:id/cancel', orderController.cancelOrder);
router.get('/:id/track', orderController.trackOrder);

// Orders management (uncomment these)
router.get('/orders/:id', hasPermission('manageOrders'), adminController.getOrderById);
router.put('/orders/:id/status', hasPermission('manageOrders'), adminController.updateOrderStatus);
router.put('/orders/:id/status', hasPermission('manageOrders'), orderController.adminUpdateOrderStatus);


// Reports (uncomment this)
router.get('/reports/sales', hasPermission('viewReports'), adminController.getSalesReport);


router.get('/:id/status', orderController.getOrderStatus);

module.exports = router;