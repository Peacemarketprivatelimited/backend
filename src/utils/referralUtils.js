const mongoose = require('mongoose');
const User = require('../models/User');

// Percentages for each level
const REFERRAL_PERCENTAGES = [0.20, 0.12, 0.10, 0.08, 0.07, 0.02, 0.02, 0.02, 0.02, 0.02];

/**
 * Build up to 10-level ancestor chain starting from a direct referrer
 * Returns [{ userId, level }, ...]
 */
async function getAncestorChain(startUserId, maxLevels = 10) {
  const chain = [];
  let currentId = startUserId;
  let level = 1;

  while (currentId && level <= maxLevels) {
    const u = await User.findById(currentId).select('_id referral.referrer').lean();
    if (!u) break;

    chain.push({ userId: u._id, level });

    currentId = u.referral && u.referral.referrer ? u.referral.referrer : null;
    level += 1;
  }

  return chain;
}

/**
 * Updates the referral chain when a new user registers with a referral code
 * - Sets newUser.referral.referrer
 * - Adds newUser to level arrays of ancestors up to level10
 */
async function updateReferralChain(newUserId, referralCode) {
  try {
    if (!referralCode) return;

    const newUser = await User.findById(newUserId).select('_id referral.referrer').lean();
    if (!newUser) return;

    // Find direct referrer by code (case-insensitive)
    const referrer = await User.findOne({
      referralCode: new RegExp(`^${referralCode}$`, 'i')
    }).select('_id referral.referrer').lean();

    if (!referrer) return;
    if (String(referrer._id) === String(newUserId)) return; // prevent self-referral

    // Get ancestor chain (level1 = direct referrer)
    const chain = await getAncestorChain(referrer._id, 10);

    // Prepare bulk ops:
    // 1) set newUser.referral.referrer
    const ops = [
      {
        updateOne: {
          filter: { _id: newUserId, 'referral.referrer': { $exists: false } },
          update: { $set: { 'referral.referrer': referrer._id } }
        }
      }
    ];

    // 2) add newUserId to each ancestor's level list
    for (const { userId, level } of chain) {
      ops.push({
        updateOne: {
          filter: { _id: userId },
          update: { $addToSet: { [`referral.level${level}`]: newUserId } }
        }
      });
    }

    await User.bulkWrite(ops, { ordered: false });
  } catch (error) {
    console.error('updateReferralChain error:', error);
  }
}

/**
 * Distribute earnings to referrers when a user purchases a subscription
 * - Increments earningsByLevel.levelX and totalEarnings for each ancestor
 */
async function distributeReferralEarnings(buyerUserId, amount) {
  try {
    const amt = Number(amount);
    if (!buyerUserId || !amt || amt <= 0) return;

    // Get buyer to find the direct referrer
    const buyer = await User.findById(buyerUserId).select('_id referral.referrer').lean();
    if (!buyer || !buyer.referral || !buyer.referral.referrer) return;

    // Build ancestor chain up to 10 levels
    const chain = await getAncestorChain(buyer.referral.referrer, 10);
    if (!chain.length) return;

    const ops = [];

    for (const { userId, level } of chain) {
      const pct = REFERRAL_PERCENTAGES[level - 1] || 0;
      if (!pct) continue;

      const commission = Math.round(amt * pct * 100) / 100; // two decimals
      if (commission <= 0) continue;

      ops.push({
        updateOne: {
          filter: { _id: userId },
          update: {
            $inc: {
              [`referral.earningsByLevel.level${level}`]: commission,
              'referral.totalEarnings': commission
            }
          }
        }
      });
    }

    if (ops.length) {
      await User.bulkWrite(ops, { ordered: false });
    }
  } catch (error) {
    console.error('distributeReferralEarnings error:', error);
  }
}

/**
 * Generate and set a referral code for a user (idempotent if already exists)
 */
async function generateReferralCode(userId) {
  try {
    const user = await User.findById(userId).select('_id name referralCode');
    if (!user) return null;
    if (user.referralCode) return user.referralCode;

    const prefix = (user.name || 'USR').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
    const suffix = Math.random().toString(36).slice(2, 10).toUpperCase();
    const code = `${prefix}${suffix}`;

    user.referralCode = code;
    await user.save();
    return code;
  } catch (error) {
    console.error('generateReferralCode error:', error);
    return null;
  }
}

/**
 * Invalidate/cleanup referral code when subscription expires (optional hook)
 */
async function handleSubscriptionExpiry(userId) {
  try {
    // Implement if you want to clear/rotate codes after expiry.
    return;
  } catch (error) {
    console.error('handleSubscriptionExpiry error:', error);
  }
}

module.exports = {
  updateReferralChain,
  distributeReferralEarnings,
  generateReferralCode,
  handleSubscriptionExpiry,
  REFERRAL_PERCENTAGES
};