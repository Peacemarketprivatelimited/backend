const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');

// Public endpoints
router.get('/', blogController.getBlogs);           // GET /api/blogs?page=1&limit=10
router.get('/:slug', blogController.getBlogBySlug); // GET /api/blogs/:slug

module.exports = router;