const mongoose = require('mongoose');

const challengeEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  day: { type: Number, required: true, min: 1, max: 7 },
  points: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, index: true }
});

// compound index for analytics: per-user latest events and date range queries
challengeEventSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ChallengeEvent', challengeEventSchema);
