const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middlewares/');
const { isAdmin, hasPermission } = require('../middlewares/adminMiddleware');

// Apply authentication and admin check to all routes
router.use(protect);
router.use(isAdmin);

// Dashboard
// router.get('/dashboard', adminController.getDashboardStats);

// User management
router.get('/users', hasPermission('manageUsers'), adminController.getAllUsers);
router.get('/users/:id', hasPermission('manageUsers'), adminController.getUserById);
router.put('/users/:id', hasPermission('manageUsers'), adminController.updateUser);
router.delete('/users/:id', hasPermission('manageUsers'), adminController.deleteUser);
router.put('/users/:id/status', hasPermission('manageUsers'), adminController.changeUserStatus);
router.put('/users/:id/role', hasPermission('manageUsers'), adminController.changeUserRole);

// Product management
// router.get('/products', hasPermission('manageProducts'), adminController.getAllProducts);
// router.post('/products', hasPermission('manageProducts'), adminController.createProduct);
// router.get('/products/:id', hasPermission('manageProducts'), adminController.getProductById);
// router.put('/products/:id', hasPermission('manageProducts'), adminController.updateProduct);
// router.delete('/products/:id', hasPermission('manageProducts'), adminController.deleteProduct);
// router.put('/products/:id/status', hasPermission('manageProducts'), adminController.changeProductStatus);

// Category management
// router.get('/categories', hasPermission('manageCategories'), adminController.getAllCategories);
// router.post('/categories', hasPermission('manageCategories'), adminController.createCategory);
// router.put('/categories/:id', hasPermission('manageCategories'), adminController.updateCategory);
// router.delete('/categories/:id', hasPermission('manageCategories'), adminController.deleteCategory);

// Order management
// router.get('/orders', hasPermission('manageOrders'), adminController.getAllOrders);
// router.get('/orders/:id', hasPermission('manageOrders'), adminController.getOrderById);
// router.put('/orders/:id/status', hasPermission('manageOrders'), adminController.updateOrderStatus);

// Subscription management
// router.get('/subscriptions', hasPermission('manageSubscriptions'), adminController.getAllSubscriptions);
// router.get('/subscriptions/:id', hasPermission('manageSubscriptions'), adminController.getSubscriptionById);

// Withdrawal management
// router.get('/withdrawals', hasPermission('manageWithdrawals'), adminController.getPendingWithdrawals);
// router.put('/withdrawals/:id/approve', hasPermission('manageWithdrawals'), adminController.approveWithdrawal);
// router.put('/withdrawals/:id/reject', hasPermission('manageWithdrawals'), adminController.rejectWithdrawal);

// Reports
// router.get('/reports/sales', hasPermission('viewReports'), adminController.getSalesReport);
// router.get('/reports/users', hasPermission('viewReports'), adminController.getUsersReport);
// router.get('/reports/referrals', hasPermission('viewReports'), adminController.getReferralsReport);
// router.get('/reports/subscriptions', hasPermission('viewReports'), adminController.getSubscriptionsReport);

module.exports = router;