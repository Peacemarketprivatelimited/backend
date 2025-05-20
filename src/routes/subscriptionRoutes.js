const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { protect } = require('../middlewares/authMiddleware');

// All subscription routes require authentication
router.use(protect);

router.post('/purchase', subscriptionController.purchaseSubscription);
router.get('/status', subscriptionController.checkSubscriptionStatus);
router.get('/referrals', subscriptionController.getReferralStats);

module.exports = router;