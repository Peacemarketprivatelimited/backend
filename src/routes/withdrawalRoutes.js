const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const withdrawalController = require("../controllers/WithdrawalController");

// Request withdrawal
router.post("/withdraw", protect, withdrawalController.requestWithdrawal);

module.exports = router;
