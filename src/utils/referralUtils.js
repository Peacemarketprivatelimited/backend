const User = require('../models/User');

// Percentages for each level
const REFERRAL_PERCENTAGES = [0.20, 0.12, 0.10, 0.08, 0.07, 0.02, 0.02, 0.02, 0.02, 0.02];

/**
 * Updates the referral chain when a new user registers with a referral code
 * @param {string} userId - ID of the new user
 * @param {string} referralCode - Referral code used during registration
 */
async function updateReferralChain(userId, referralCode) {
  try {
    if (!referralCode) return false;

    // Find direct referrer (level 1)
    const directReferrer = await User.findOne({ 
      referralCode, 
      'subscription.isActive': true,
      'subscription.expiryDate': { $gt: new Date() }
    });

    if (!directReferrer) return false;
    
    // Add new user to direct referrer's level1
    await User.findByIdAndUpdate(directReferrer._id, {
      $addToSet: { 'referral.level1': userId }
    });
    
    // Set referrer for the new user
    await User.findByIdAndUpdate(userId, {
      'referral.referrer': directReferrer._id
    });
    
    // Now build the chain up to 10 levels
    let currentUser = directReferrer;
    let level = 2;
    
    // Traverse up the referral chain
    while (level <= 10 && currentUser.referral && currentUser.referral.referrer) {
      // Get the next user up in the hierarchy
      const upperReferrer = await User.findById(currentUser.referral.referrer);
      
      if (!upperReferrer) break;
      
      // Add new user to the appropriate level array
      const updateQuery = {};
      updateQuery[`referral.level${level}`] = userId;
      
      await User.findByIdAndUpdate(upperReferrer._id, {
        $addToSet: updateQuery
      });
      
      // Move up the chain
      currentUser = upperReferrer;
      level++;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating referral chain:', error);
    return false;
  }
}

/**
 * Distribute earnings to referrers when a user purchases a subscription
 * @param {string} userId - User who made the purchase
 * @param {number} amount - Subscription amount
 */
async function distributeReferralEarnings(userId, amount) {
  try {
    // Find user to start traversing the chain
    const user = await User.findById(userId);
    if (!user || !user.referral || !user.referral.referrer) return;
    
    let currentLevel = 1;
    let currentReferrerId = user.referral.referrer;
    
    // Traverse up the referral chain
    while (currentLevel <= 10 && currentReferrerId) {
      // Find the referrer
      const referrer = await User.findById(currentReferrerId);
      if (!referrer) break;
      
      // Calculate commission for this level
      const percentage = REFERRAL_PERCENTAGES[currentLevel - 1];
      const commission = amount * percentage;
      
      // Update the referrer's earnings
      const updateQuery = {
        $inc: {
          [`referral.earningsByLevel.level${currentLevel}`]: commission,
          'referral.totalEarnings': commission
        }
      };
      
      await User.findByIdAndUpdate(referrer._id, updateQuery);
      
      // Move up the chain
      currentReferrerId = referrer.referral.referrer;
      currentLevel++;
    }
  } catch (error) {
    console.error('Error distributing referral earnings:', error);
  }
}

/**
 * Generate a referral code for a user when they purchase a subscription
 * @param {string} userId - User ID
 * @returns {string|null} Generated referral code or null if failed
 */
async function generateReferralCode(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return null;
    
    // Generate referral code
    const referralCode = user.generateReferralCode();
    await user.save();
    
    return referralCode;
  } catch (error) {
    console.error('Error generating referral code:', error);
    return null;
  }
}

/**
 * Invalidate referral code when subscription expires
 * @param {string} userId - User ID
 */
async function handleSubscriptionExpiry(userId) {
  try {
    await User.findByIdAndUpdate(userId, {
      'subscription.isActive': false
    });
    // Note: We keep the referralCode but it's now invalid since subscription.isActive = false
  } catch (error) {
    console.error('Error handling subscription expiry:', error);
  }
}

module.exports = {
  updateReferralChain,
  distributeReferralEarnings,
  generateReferralCode,
  handleSubscriptionExpiry,
  REFERRAL_PERCENTAGES
};