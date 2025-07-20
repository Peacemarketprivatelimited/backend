const withdrawalController = require("../controllers/WithdrawalController");
const { protect } = require("../middlewares/authMiddleware");
const express = require("express");
const router = express.Router();

router.post("/withdraw", protect, withdrawalController.requestWithdrawal);
