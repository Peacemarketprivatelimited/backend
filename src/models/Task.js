const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  platform: { type: String, default: 'generic' },
  actionUrl: { type: String, default: '' },
  points: { type: Number, required: true, min: 0 },
  repeatable: { type: Boolean, default: false },
  maxPerUser: { type: Number, default: 1 },
  expiryDate: { type: Date },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
