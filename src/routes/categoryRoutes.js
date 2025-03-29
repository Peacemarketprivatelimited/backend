const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect } = require('../middlewares/authMiddleware');
const { isAdmin, hasPermission } = require('../middlewares/adminMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

// Public category routes
router.get('/', categoryController.getAllCategories);
router.get('/featured', categoryController.getFeaturedCategories);
router.get('/:slug', categoryController.getCategoryBySlug);
router.get('/id/:id', categoryController.getCategoryById);

// Protected admin routes
router.use(protect);
router.use(isAdmin);
router.use(hasPermission('manageCategories'));

// Admin category routes
router.post('/', uploadMiddleware.single('image'), categoryController.createCategory);
router.put('/:id', uploadMiddleware.single('image'), categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);
router.put('/:id/status', categoryController.updateCategoryStatus);
router.put('/:id/feature', categoryController.toggleFeatureCategory);
router.put('/:id/order', categoryController.updateCategoryOrder);
router.put('/:id/discount', categoryController.updateCategoryDiscount);

module.exports = router;