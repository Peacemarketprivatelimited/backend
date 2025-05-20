const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");

// Public routes
router.post("/register", userController.register);
router.post("/login", userController.login);

// Protected routes - require authentication
router.get("/profile", protect, userController.getUserProfile);
router.put("/profile", protect, userController.updateUserProfile);
router.put("/bank-details", protect, userController.updateBankDetails);
router.post("/withdraw", protect, userController.requestWithdrawal);
router.get("/referrals", protect, userController.getReferralStats);

module.exports = router;