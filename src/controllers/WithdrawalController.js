const User = require("../models/User");

// User withdrawal request controller
exports.requestWithdrawal = async (req, res) => {
  try {
    const { bankAccount } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.withdrawals.pendingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal request'
      });
    }

    if (user.referral.totalEarnings <= 0) {
      return res.status(400).json({
        success: false,
        message: 'You do not have any earnings to withdraw'
      });
    }

    // Update user withdrawal info
    user.withdrawals.pendingRequest = true;
    user.withdrawals.requestedAt = new Date();
    user.withdrawals.amount = user.referral.totalEarnings;
    
    // Set bank account details if provided
    if (bankAccount) {
      user.withdrawals.bankAccount = bankAccount;
    }

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully'
    });
  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing withdrawal request',
      error: error.message
    });
  }
};
