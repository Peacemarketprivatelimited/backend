// backend/src/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/purchase-subscription', paymentController.purchaseSubscription);
router.post('/verify-jazzcash', paymentController.verifyPayment);

module.exports = router;
