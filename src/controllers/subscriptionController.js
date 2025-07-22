const User = require("../models/User");
const { distributeReferralEarnings, generateReferralCode } = require("../utils/referralUtils");

/**
 * @desc    Purchase a subscription
 * @route   POST /api/subscription/purchase
 * @access  Private
 */
exports.purchaseSubscription = async (req, res) => {
  try {
    const { paymentMethod, subscriptionId, amount } = req.body;
    const userId = req.user.id;
    
    // Default subscription period (6 months)
    const SIX_MONTHS_IN_MS = 6 * 30 * 24 * 60 * 60 * 1000;
    
    // Validate payment details (simplified for this example)
    // In reality, you would integrate with Stripe, JazzCash, etc.
    if (!paymentMethod || !amount) {
      return res.status(400).json({
        success: false,
        message: "Payment information is required"
      });
    }
    
    // Update user subscription
    const now = new Date();
    const expiryDate = new Date(now.getTime() + SIX_MONTHS_IN_MS);
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Update subscription details
    user.subscription = {
      isActive: true,
      purchaseDate: now,
      expiryDate: expiryDate,
      amountPaid: amount,
      subscriptionId: subscriptionId || `sub_${Date.now()}`
    };
    
    // Generate referral code if not exists or expired
    if (!user.referralCode || !user.hasValidReferralCode()) {
      user.generateReferralCode();
    }
    
    await user.save();
    
    // Distribute earnings to referrers if this user was referred
    if (user.referral && user.referral.referrer) {
      await distributeReferralEarnings(userId, amount);
    }
    
    res.status(200).json({
      success: true,
      message: "Subscription purchased successfully",
      subscription: {
        isActive: user.subscription.isActive,
        purchaseDate: user.subscription.purchaseDate,
        expiryDate: user.subscription.expiryDate,
        referralCode: user.referralCode
      }
    });
  } catch (error) {
    console.error("Subscription purchase error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to purchase subscription",
      error: error.message
    });
  }
};

/**
 * @desc    Check subscription status
 * @route   GET /api/subscription/status
 * @access  Private
 */
exports.checkSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    const isActive = user.subscription.isActive && 
                     user.subscription.expiryDate > new Date();
    
    res.status(200).json({
      success: true,
      subscription: {
        isActive,
        purchaseDate: user.subscription.purchaseDate,
        expiryDate: user.subscription.expiryDate,
        referralCode: user.referralCode,
        daysRemaining: isActive ? 
          Math.ceil((user.subscription.expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : 0
      }
    });
  } catch (error) {
    console.error("Subscription status check error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check subscription status",
      error: error.message
    });
  }
};

/**
 * @desc    Get referral statistics
 * @route   GET /api/subscription/referrals
 * @access  Private
 */
exports.getReferralStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId)
      .populate('referral.level1', 'name username subscription.isActive subscription.expiryDate')
      .exec();
      
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Calculate active referrals
    const activeReferrals = user.referral.level1.filter(ref => 
      ref.subscription && ref.subscription.isActive
    ).length;
    
    // Prepare counts for each level
    const referralCounts = {};
    for (let i = 1; i <= 10; i++) {
      referralCounts[`level${i}`] = user.referral[`level${i}`].length;
    }
    
    res.status(200).json({
      success: true,
      referralCode: user.referralCode,
      isSubscriptionActive: user.subscription.isActive && user.subscription.expiryDate > new Date(),
      subscriptionExpiry: user.subscription.expiryDate,
      referralStats: {
        directReferrals: {
          total: user.referral.level1.length,
          active: activeReferrals
        },
        earnings: user.referral.earningsByLevel,
        totalEarnings: user.referral.totalEarnings,
        counts: referralCounts
      }
    });
  } catch (error) {
    console.error("Referral stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get referral statistics",
      error: error.message
    });
  }
};