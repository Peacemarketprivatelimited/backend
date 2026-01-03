const Video = require('../models/Video');
const User = require('../models/User');
const { Cache, TTL, CACHE_KEYS } = require('../config/redisConfig');

/**
 * Admin: create video
 * POST /api/admin/videos
 */
exports.createVideo = async (req, res) => {
  try {
    const { title, embedUrl, points = 0, active = true } = req.body;
    if (!title || !embedUrl) return res.status(400).json({ success: false, message: 'title and embedUrl required' });

    const video = await Video.create({
      title,
      embedUrl,
      points: Number(points),
      active: Boolean(active),
      createdBy: req.user?.id
    });

    // Invalidate video caches
    await Cache.invalidateVideos();

    return res.status(201).json({ success: true, video });
  } catch (err) {
    console.error('createVideo error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: list videos
 * GET /api/admin/videos
 */
exports.adminListVideos = async (req, res) => {
  try {
    const { active } = req.query;
    const q = {};
    if (active === 'true') q.active = true;
    if (active === 'false') q.active = false;
    const videos = await Video.find(q).sort({ createdAt: -1 });
    return res.json({ success: true, count: videos.length, videos });
  } catch (err) {
    console.error('adminListVideos error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: delete video
 * DELETE /api/admin/videos/:id
 */
exports.deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const video = await Video.findById(id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    await Video.findByIdAndDelete(id);
    
    // Invalidate video caches
    await Cache.invalidateVideos();
    
    return res.json({ success: true, message: 'Video deleted' });
  } catch (err) {
    console.error('deleteVideo error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Public: list active videos
 * GET /api/videos
 */
exports.listVideos = async (req, res) => {
  try {
    // Check cache first
    const cacheKey = `${CACHE_KEYS.VIDEOS}active`;
    const cached = await Cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    const videos = await Video.find({ active: true }).sort({ createdAt: -1 });
    
    const responseData = { success: true, count: videos.length, videos };
    await Cache.set(cacheKey, responseData, TTL.MEDIUM);
    
    return res.json(responseData);
  } catch (err) {
    console.error('listVideos error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * User: mark video complete and credit points (idempotent)
 * POST /api/videos/:id/complete
 */
exports.completeVideo = async (req, res) => {
  try {
    const userId = req.user.id;
    const videoId = req.params.id;

    const video = await Video.findById(videoId);
    if (!video || !video.active) return res.status(404).json({ success: false, message: 'Video not found' });

    // atomic update: only credit if user hasn't watched this video before
    const update = await User.findOneAndUpdate(
      { _id: userId, 'watchedVideos.video': { $ne: video._id } },
      {
        $inc: { pointsBalance: video.points || 0 },
        $push: {
          watchedVideos: {
            video: video._id,
            points: video.points || 0,
            credited: true,
            watchedAt: new Date()
          }
        }
      },
      { new: true }
    ).select('pointsBalance watchedVideos');

    if (!update) {
      // already watched / credited
      return res.status(200).json({ success: true, message: 'Already credited for this video' });
    }

    // best-effort increment watchersCount
    try {
      video.watchersCount = (video.watchersCount || 0) + 1;
      await video.save();
    } catch (e) { /* non-fatal */ }

    return res.status(200).json({ success: true, message: 'Points credited', points: video.points, pointsBalance: update.pointsBalance });
  } catch (err) {
    console.error('completeVideo error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * User: convert points to currency and add to referral.totalEarnings
 * POST /api/videos/convert
 * body: { points: number }  (minimum 1000)
 */
exports.convertPoints = async (req, res) => {
  try {
    const userId = req.user.id;
    const { points } = req.body;
    const pts = Number(points || 0);
    if (isNaN(pts) || pts <= 0) return res.status(400).json({ success: false, message: 'points required' });
    if (pts < 1000) return res.status(400).json({ success: false, message: 'minimum 1000 points required' });

    // conversion rate: 1000 points = 100 Rs => 10 points = 1 Rs
    const rsAmount = Number((pts / 10).toFixed(2));

    // atomic: only proceed if user has enough points
    const updated = await User.findOneAndUpdate(
      { _id: userId, pointsBalance: { $gte: pts } },
      {
        $inc: {
          pointsBalance: -pts,
          'referral.totalEarnings': rsAmount,
          'referral.earningsByLevel.level1': rsAmount // optional audit
        }
      },
      { new: true }
    ).select('pointsBalance referral.totalEarnings');

    if (!updated) return res.status(400).json({ success: false, message: 'Insufficient points' });

    return res.json({ success: true, message: 'Points converted', convertedPoints: pts, creditedRs: rsAmount, pointsBalance: updated.pointsBalance, totalEarnings: updated.referral.totalEarnings });
  } catch (err) {
    console.error('convertPoints error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
exports.getUserPoints = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('pointsBalance referral.totalEarnings');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ 
      success: true, 
      pointsBalance: user.pointsBalance || 0,
      totalEarnings: user.referral.totalEarnings || 0
    });
  } catch (err) {
    console.error('getUserPoints error', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};