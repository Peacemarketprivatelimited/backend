const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  pointsAwarded: { type: Number, default: 0 },
  status: { type: String, enum: ['completed'], default: 'completed' },
  completedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// enforce one-time completion per user per task
submissionSchema.index({ task: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('TaskSubmission', submissionSchema);
