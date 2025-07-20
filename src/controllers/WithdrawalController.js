const User = require("../models/User");

// User withdrawal request controller
exports.requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Only allow requests on Sunday
    const today = new Date();
    if (today.getDay() !== 0) {
      return res.status(400).json({ success: false, message: "Withdrawals are only open on Sundays" });
    }

    // Check for pending request
    if (user.withdrawals.pendingRequest) {
      return res.status(400).json({ success: false, message: "You already have a pending withdrawal request" });
    }

    // Check earnings
    if (user.referral.totalEarnings <= 0) {
      return res.status(400).json({ success: false, message: "No earnings to withdraw" });
    }

    // 10% deduction
    const amountRequested = user.referral.totalEarnings;
    const amountPaid = Math.floor(amountRequested * 0.9);

    // Add to history
    user.withdrawals.history.push({
      amountRequested,
      amountPaid,
      status: 'pending',
      requestedAt: today
    });

    user.withdrawals.pendingRequest = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Withdrawal request submitted",
      withdrawal: {
        amountRequested,
        amountPaid,
        status: 'pending'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to submit withdrawal", error: error.message });
  }
};
