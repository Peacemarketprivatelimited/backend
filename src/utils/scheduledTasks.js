const User = require('../models/User');
const { handleSubscriptionExpiry } = require('./referralUtils');

/**
 * Daily check for expired subscriptions
 */
async function checkExpiredSubscriptions() {
  try {
    const now = new Date();
    
    // Find users with expired subscriptions
    const expiredUsers = await User.find({
      'subscription.isActive': true,
      'subscription.expiryDate': { $lt: now }
    });
    
    console.log(`Found ${expiredUsers.length} expired subscriptions`);
    
    // Process each expired subscription
    for (const user of expiredUsers) {
      await handleSubscriptionExpiry(user._id);
    }
  } catch (error) {
    console.error('Error checking expired subscriptions:', error);
  }
}

module.exports = {
  checkExpiredSubscriptions
};