const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");
const challengeController = require('../controllers/challengeController');
const taskController = require('../controllers/taskController');

// Public routes
router.post("/register", userController.register);
router.post("/login", userController.login);
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password", userController.resetPassword);

// Protected routes - require authentication
router.get("/profile", protect, userController.getUserProfile);
router.put("/profile", protect, userController.updateUserProfile);
router.put("/bank-details", protect, userController.updateBankDetails);
router.post("/withdraw", protect, userController.requestWithdrawal);
router.get("/referrals", protect, userController.getReferralStats);

// Challenge endpoints
router.get('/challenge/status', protect, challengeController.getStatus);
router.post('/challenge/claim', protect, challengeController.claim);

// Tasks (subscribed users)
router.get('/tasks', protect, taskController.listTasksForUser);
router.post('/tasks/:id/complete', protect, taskController.completeTask);
router.get('/tasks/submissions', protect, taskController.userSubmissions);

module.exports = router;