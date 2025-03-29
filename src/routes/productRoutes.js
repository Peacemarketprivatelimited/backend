const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect } = require('../middlewares/authMiddleware');
const { isAdmin, hasPermission } = require('../middlewares/adminMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

// Public product routes
router.get('/', productController.getAllProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/discounted', productController.getDiscountedProducts);
router.get('/category/:categoryId', productController.getProductsByCategory);
router.get('/search', productController.searchProducts);
router.get('/:slug', productController.getProductBySlug);
router.get('/id/:id', productController.getProductById);

// Protected admin routes
router.use(protect);
router.use(isAdmin);
router.use(hasPermission('manageProducts'));

// Admin product routes - CRUD operations
router.post('/', uploadMiddleware.array('images', 5), productController.createProduct);
router.put('/:id', uploadMiddleware.array('images', 5), productController.updateProduct);
router.delete('/:id', productController.deleteProduct);
router.put('/:id/status', productController.updateProductStatus);
router.put('/:id/feature', productController.toggleFeatureProduct);
router.post('/:id/images', uploadMiddleware.array('images', 5), productController.addProductImages);
router.delete('/:id/images/:imageId', productController.removeProductImage);

module.exports = router;