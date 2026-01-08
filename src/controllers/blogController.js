const Blog = require('../models/Blog');
const slugify = require('slugify');
const mongoose = require('mongoose');
const s3Utils = require('../utils/s3Utils'); // s3 helpers (upload/delete)
 
// helper to upload req.file (supports several s3Utils APIs)
async function uploadReqFileToS3(file) {
  if (!file) return null;
  // prefer streaming/buffer upload function names commonly used
  if (typeof s3Utils.uploadFile === 'function') {
    return await s3Utils.uploadFile(file);
  }
  if (typeof s3Utils.uploadBuffer === 'function') {
    return await s3Utils.uploadBuffer(file.buffer, file.originalname, file.mimetype);
  }
  if (typeof s3Utils.upload === 'function') {
    return await s3Utils.upload(file);
  }
  // fallback: try uploadFromBuffer
  if (typeof s3Utils.uploadFromBuffer === 'function') {
    return await s3Utils.uploadFromBuffer(file.buffer, file.originalname, file.mimetype);
  }
  throw new Error('s3Utils does not expose an upload helper (uploadFile/uploadBuffer/upload/uploadFromBuffer)');
}
 
// helper to delete by key/public_id
async function deleteS3Key(keyOrId) {
  if (!keyOrId) return;
  if (typeof s3Utils.deleteFile === 'function') {
    return await s3Utils.deleteFile(keyOrId);
  }
  if (typeof s3Utils.delete === 'function') {
    return await s3Utils.delete(keyOrId);
  }
  if (typeof s3Utils.deleteFromS3 === 'function') {
    return await s3Utils.deleteFromS3(keyOrId);
  }
  // no delete available — ignore silently
  return;
}
 
exports.createBlog = async (req, res) => {
  try {
    const { title, excerpt, content, tags = [], status = 'draft', publishedAt } = req.body;
    const slugBase = slugify(title || Date.now().toString(), { lower: true, strict: true });
    let slug = slugBase;
    let i = 0;
    while (await Blog.findOne({ slug })) {
      i++;
      slug = `${slugBase}-${i}`;
    }
 
    // handle featured image upload from multipart/form-data (req.file) OR accept featuredImage object/url in body
    let featuredImageObj = null;
    if (req.file) {
      const uploadRes = await uploadReqFileToS3(req.file);
      // common return shapes: { Location, Key } or { url, key } or { url, public_id }
      featuredImageObj = {
        url: uploadRes.Location || uploadRes.url || uploadRes.location || uploadRes.Location,
        public_id: uploadRes.Key || uploadRes.key || uploadRes.public_id || uploadRes.publicId || uploadRes.name,
        alt: req.body.featuredImageAlt || ''
      };
    } else if (req.body.featuredImage) {
      // accept { url, public_id, alt } from client
      try {
        const parsed = typeof req.body.featuredImage === 'string' ? JSON.parse(req.body.featuredImage) : req.body.featuredImage;
        featuredImageObj = {
          url: parsed.url,
          public_id: parsed.public_id || parsed.key || parsed.publicId,
          alt: parsed.alt || ''
        };
      } catch (e) {
        // ignore parse error, assume string url
        featuredImageObj = { url: req.body.featuredImage, public_id: req.body.featuredImagePublicId || null, alt: req.body.featuredImageAlt || '' };
      }
    }
 
    const blog = await Blog.create({
      title,
      slug,
      excerpt,
      content,
      author: req.user && req.user.id ? req.user.id : undefined,
      tags,
      featuredImage: featuredImageObj,
      status,
      publishedAt: status === 'published' ? (publishedAt || new Date()) : publishedAt
    });
    return res.status(201).json({ success: true, blog });
  } catch (error) {
    console.error('createBlog error', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
 
exports.updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const updates = { ...req.body };
    if (updates.title) {
      updates.slug = slugify(updates.title, { lower: true, strict: true });
    }
    if (updates.status === 'published' && !updates.publishedAt) updates.publishedAt = new Date();
 
    // If a new file is uploaded, upload it and delete previous image if present
    if (req.file) {
      const uploadRes = await uploadReqFileToS3(req.file);
      updates.featuredImage = {
        url: uploadRes.Location || uploadRes.url || uploadRes.location,
        public_id: uploadRes.Key || uploadRes.key || uploadRes.public_id || uploadRes.publicId || uploadRes.name,
        alt: req.body.featuredImageAlt || ''
      };
      // fetch existing blog to delete existing image
      const existing = await Blog.findById(id).select('featuredImage');
      if (existing && existing.featuredImage && (existing.featuredImage.public_id || existing.featuredImage.url)) {
        // prefer public_id/key, fallback to url
        const keyToDelete = existing.featuredImage.public_id || existing.featuredImage.url;
        // delete async (don't block on failure)
        try { await deleteS3Key(keyToDelete); } catch (e) { console.warn('Failed to delete old blog image', e); }
      }
    } else if (req.body.featuredImage) {
      // allow updating featuredImage via JSON in body
      try {
        const parsed = typeof req.body.featuredImage === 'string' ? JSON.parse(req.body.featuredImage) : req.body.featuredImage;
        updates.featuredImage = {
          url: parsed.url,
          public_id: parsed.public_id || parsed.key || parsed.publicId,
          alt: parsed.alt || ''
        };
      } catch (e) {
        updates.featuredImage = { url: req.body.featuredImage, public_id: req.body.featuredImagePublicId || null, alt: req.body.featuredImageAlt || '' };
      }
    }
 
    const blog = await Blog.findByIdAndUpdate(id, updates, { new: true });
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    return res.json({ success: true, blog });
  } catch (error) {
    console.error('updateBlog error', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
exports.getBlogByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid blog id' });
    }
    const blog = await Blog.findById(id).populate('author', 'name username email');
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    res.json({ success: true, blog });
  } catch (error) {
    console.error('getBlogByIdAdmin error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const blog = await Blog.findByIdAndDelete(id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    // delete image if present
    if (blog.featuredImage && (blog.featuredImage.public_id || blog.featuredImage.url)) {
      try { await deleteS3Key(blog.featuredImage.public_id || blog.featuredImage.url); } catch (e) { console.warn('Failed to delete blog image', e); }
    }
    return res.json({ success: true, message: 'Blog deleted' });
  } catch (error) {
    console.error('deleteBlog error', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin list (paginated)
exports.getAllBlogsAdmin = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const filter = {}; // admins can expand filters if needed
    const [blogs, total] = await Promise.all([
      Blog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Blog.countDocuments(filter)
    ]);
    return res.json({ success: true, blogs, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('getAllBlogsAdmin error', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Public list (published only)
// exports.getBlogs = async (req, res) => {
//   try {
//     const page = Math.max(1, parseInt(req.query.page) || 1);
//     const limit = Math.min(100, parseInt(req.query.limit) || 10);
//     const skip = (page - 1) * limit;
//     const q = req.query.q ? { $text: { $search: req.query.q } } : {};
//     const filter = { status: 'published', ...q };
//     const [blogs, total] = await Promise.all([
//       Blog.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(limit).select('title slug excerpt publishedAt tags featuredImage author').lean(),
//       Blog.countDocuments(filter)
//     ]);
//     // console.log(blogs)
//     return res.json({ success: true, blogs, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
//   } catch (error) {
//     console.error('getBlogs error', error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

// exports.getBlogBySlug = async (req, res) => {
//   try {
//     const { slug } = req.params;
//     const blog = await Blog.findOne({ slug, status: 'published' }).populate('author', 'name username').lean();
//     if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
//     return res.json({ success: true, blog });
//   } catch (error) {
//     console.error('getBlogBySlug error', error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };


// ...existing code...

// Public list (published only)
exports.getBlogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;
    const q = req.query.q ? { $text: { $search: req.query.q } } : {};
    const filter = { status: 'published', ...q };
    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title slug excerpt content publishedAt tags featuredImage author') // Added 'content' here
        .lean(),
      Blog.countDocuments(filter)
    ]);
    return res.json({ success: true, blogs, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('getBlogs error', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const blog = await Blog.findOne({ slug, status: 'published' })
      .populate('author', 'name username')
      .lean();
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    return res.json({ success: true, blog });
  } catch (error) {
    console.error('getBlogBySlug error', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ...existing code...