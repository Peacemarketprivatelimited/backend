const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const { protect } = require('../middlewares/authMiddleware');

// public list
router.get('/', videoController.listVideos);

// user marks complete (protected)
router.post('/:id/complete', protect, videoController.completeVideo);

// user converts points to currency (protected)
router.post('/convert', protect, videoController.convertPoints);

router.get('/user-points', protect, videoController.getUserPoints);

module.exports = router;