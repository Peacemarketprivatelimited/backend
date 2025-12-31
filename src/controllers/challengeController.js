const User = require('../models/User');
const ChallengeEvent = require('../models/ChallengeEvent');

const POINTS = [25, 50, 75, 100, 125, 150, 200];
const MS = (hours) => hours * 60 * 60 * 1000;

exports.getStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('challenge subscription pointsBalance');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // subscription check
    const sub = user.subscription || {};
    if (!sub.isActive || !sub.expiryDate || new Date(sub.expiryDate) <= new Date()) {
      return res.status(403).json({ success: false, message: 'Active subscription required' });
    }

    const last = user.challenge.lastClaimedAt;
    const now = Date.now();
    let eligible = false;
    let timeUntilNextClaim = null;

    if (!last) {
      eligible = true;
    } else {
      const diff = now - new Date(last).getTime();
      if (diff < MS(24)) {
        eligible = false;
        timeUntilNextClaim = MS(24) - diff;
      } else if (diff >= MS(24) && diff < MS(48)) {
        eligible = true;
      } else {
        // skipped window -> eligible but will reset to day 1 on claim
        eligible = true;
      }
    }

    const currentDay = Math.max(1, user.challenge.currentDay || 1);
    const pointsToday = POINTS[Math.min(6, currentDay - 1)];

    res.json({
      success: true,
      currentDay,
      pointsToday,
      lastClaimedAt: last,
      eligible,
      timeUntilNextClaim,
      pointsBalance: user.pointsBalance || 0,
      totalChallengePoints: user.challenge.totalChallengePoints || 0
    });
  } catch (error) {
    console.error('Challenge getStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.claim = async (req, res) => {
  try {
    // Read user doc first to compute business rules, then do a conditional update
    const user = await User.findById(req.user.id).select('challenge subscription pointsBalance');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const sub = user.subscription || {};
    if (!sub.isActive || !sub.expiryDate || new Date(sub.expiryDate) <= new Date()) {
      return res.status(403).json({ success: false, message: 'Active subscription required' });
    }

    const now = Date.now();
    const last = user.challenge.lastClaimedAt ? new Date(user.challenge.lastClaimedAt).getTime() : null;
    let currentDay = user.challenge.currentDay || 1;

    if (last) {
      const diff = now - last;
      if (diff < MS(24)) {
        return res.status(400).json({ success: false, message: 'Too early to claim. Wait until 24 hours passed.' });
      } else if (diff >= MS(48)) {
        // skipped -> reset to day 1
        currentDay = 1;
      }
    } else {
      currentDay = 1;
    }

    const dayIndex = Math.min(7, Math.max(1, currentDay));
    const points = POINTS[dayIndex - 1];

    // Build conditional: ensure lastClaimedAt hasn't changed since we read it
    const lastCondition = user.challenge.lastClaimedAt ? user.challenge.lastClaimedAt : null;
    const condition = { _id: user._id, 'challenge.lastClaimedAt': lastCondition };

    // Prepare update: increment balances, push completedDays, set lastClaimedAt and next currentDay
    const nextDay = dayIndex === 7 ? 1 : dayIndex + 1;
    const update = {
      $inc: {
        pointsBalance: points,
        'challenge.totalChallengePoints': points
      },
      $set: {
        'challenge.lastClaimedAt': new Date(now),
        'challenge.currentDay': nextDay,
        'challenge.isActive': true
      },
      $push: {
        'challenge.completedDays': new Date(now)
      }
    };

    const updated = await User.findOneAndUpdate(condition, update, { new: true });
    if (!updated) {
      // concurrent update occurred — ask client to retry (safe)
      return res.status(409).json({ success: false, message: 'Claim conflict, please retry' });
    }

    // create claim event for analytics (best-effort)
    try {
      await ChallengeEvent.create({ user: user._id, day: dayIndex, points });
    } catch (e) {
      console.warn('Failed to create ChallengeEvent:', e.message);
    }

    res.json({ success: true, message: 'Points awarded', pointsAwarded: points, pointsBalance: updated.pointsBalance, nextDay: updated.challenge.currentDay });
  } catch (error) {
    console.error('Challenge claim error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.POINTS = POINTS;
