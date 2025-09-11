const User = require("../models/User");

// User withdrawal request controller
exports.requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Require bank details
    if (!user.withdrawals || !user.withdrawals.bankAccount || !user.withdrawals.bankAccount.accountNumber) {
      return res.status(400).json({ success: false, message: "Please update your bank details first" });
    }

    // Prevent duplicate pending
    if (user.withdrawals.pendingRequest) {
      return res.status(400).json({ success: false, message: "You already have a pending withdrawal request" });
    }

    const gross = Number(user.referral?.totalEarnings || 0);
    if (!gross || gross <= 0) {
      return res.status(400).json({ success: false, message: "You don't have any earnings to withdraw" });
    }

    // 10% fee → pay 90%
    const net = Math.round(gross * 0.9 * 100) / 100;

    const entry = {
      status: 'pending',
      requestedAt: new Date(),
      processedAt: null,
      amountRequested: gross,
      amountPaid: net,
      adminNote: ''
    };

    user.withdrawals = user.withdrawals || {};
    user.withdrawals.history = user.withdrawals.history || [];
    user.withdrawals.history.push(entry);
    user.withdrawals.pendingRequest = true;

    await user.save();

    // return historyId so admin can approve by id (more reliable than matching timestamps)
    const created = user.withdrawals.history[user.withdrawals.history.length - 1];
    return res.json({
      success: true,
      message: "Withdrawal request submitted successfully",
      historyId: created._id,
      requestedAt: created.requestedAt
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to request withdrawal", error: error.message });
  }
};
