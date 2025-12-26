const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const User = require('../models/User');

// Admin: create task
exports.createTask = async (req, res) => {
  try {
    const payload = { ...req.body, createdBy: req.user.id };
    const task = await Task.create(payload);
    return res.status(201).json({ success: true, task });
  } catch (err) {
    console.error('createTask error', err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    return res.json({ success: true, task });
  } catch (err) {
    console.error('updateTask error', err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    return res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    console.error('deleteTask error', err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.adminListTasks = async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    return res.json({ success: true, tasks });
  } catch (err) {
    console.error('adminListTasks error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// User: list tasks (only subscribed users) with completed flag
exports.listTasksForUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('subscription');
    const now = new Date();
    if (!user || !user.subscription?.isActive || !user.subscription?.expiryDate || user.subscription.expiryDate <= now) {
      return res.status(403).json({ success: false, message: 'Active subscription required' });
    }

    const tasks = await Task.find({ isActive: true, $or: [{ expiryDate: { $exists: false } }, { expiryDate: { $gt: now } }] }).lean();
    const submissions = await TaskSubmission.find({ user: req.user.id }).select('task completedAt').lean();
    const doneMap = new Map(submissions.map(s => [String(s.task), s.completedAt]));

    const payload = tasks.map(t => ({
      _id: t._id,
      title: t.title,
      description: t.description,
      platform: t.platform,
      actionUrl: t.actionUrl,
      points: t.points,
      expiryDate: t.expiryDate,
      isActive: t.isActive,
      completed: !!doneMap.get(String(t._id)),
      completedAt: doneMap.get(String(t._id)) || null,
      createdAt: t.createdAt
    }));

    return res.json({ success: true, tasks: payload });
  } catch (err) {
    console.error('listTasksForUser error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// User: complete task (auto-complete, immediate points award)
exports.completeTask = async (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;
  const now = new Date();

  try {
    const user = await User.findById(userId).select('subscription');
    if (!user || !user.subscription?.isActive || !user.subscription?.expiryDate || user.subscription.expiryDate <= now) {
      return res.status(403).json({ success: false, message: 'Active subscription required' });
    }

    const task = await Task.findById(taskId);
    if (!task || !task.isActive) return res.status(404).json({ success: false, message: 'Task not found or inactive' });
    if (task.expiryDate && task.expiryDate <= now) return res.status(400).json({ success: false, message: 'Task expired' });

    // Use transaction to create submission and increment user points atomically
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await TaskSubmission.create([{ task: task._id, user: userId, pointsAwarded: task.points, completedAt: now }], { session });
      const updatedUser = await User.findByIdAndUpdate(userId, { $inc: { pointsBalance: task.points } }, { new: true, session });
      await session.commitTransaction();
      session.endSession();

      return res.json({ success: true, message: 'Task completed. Points awarded.', pointsAwarded: task.points, pointsBalance: updatedUser.pointsBalance });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      if (err && err.code === 11000) {
        return res.status(400).json({ success: false, message: 'Task already completed by user' });
      }
      throw err;
    }
  } catch (err) {
    console.error('completeTask error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.userSubmissions = async (req, res) => {
  try {
    const subs = await TaskSubmission.find({ user: req.user.id }).populate('task').sort({ completedAt: -1 });
    return res.json({ success: true, submissions: subs });
  } catch (err) {
    console.error('userSubmissions error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
