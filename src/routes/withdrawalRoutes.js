const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const withdrawalController = require("../controllers/WithdrawalController"); // added import

// Request withdrawal
router.post("/withdraw", protect, withdrawalController.requestWithdrawal);

// (optional) list user withdrawal history
// router.get("/history", protect, withdrawalController.getHistory);

module.exports = router; // added export
