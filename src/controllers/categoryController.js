const Category = require('../models/Category');
const Product = require('../models/Product');
const { uploadToS3, deleteFromS3 } = require('../utils/s3Utils');
const mongoose = require('mongoose');

/**
 * @desc    Get all categories
 * @route   GET /api/categories
 * @access  Public
 */
exports.getAllCategories = async (req, res) => {
  try {
    const { active } = req.query;
    
    let query = {};
    
    // Filter by active status if provided
    if (active === 'true') {
      query.active = true;
    } else if (active === 'false') {
      query.active = false;
    }
    
    const categories = await Category.find(query)
      .sort({ order: 1, name: 1 });
    
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
};

/**
 * @desc    Get featured categories
 * @route   GET /api/categories/featured
 * @access  Public
 */
exports.getFeaturedCategories = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    const categories = await Category.findFeatured(Number(limit));
    
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error fetching featured categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured categories',
      error: error.message
    });
  }
};

/**
 * @desc    Get category by slug
 * @route   GET /api/categories/:slug
 * @access  Public
 */
exports.getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const category = await Category.findOne({ slug, active: true });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.json({
      success: true,
      category
    });
  } catch (error) {
    console.error('Error fetching category by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message
    });
  }
};

/**
 * @desc    Get category by ID
 * @route   GET /api/categories/id/:id
 * @access  Public
 */
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findById(id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.json({
      success: true,
      category
    });
  } catch (error) {
    console.error('Error fetching category by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message
    });
  }
};

/**
 * @desc    Create a new category
 * @route   POST /api/categories
 * @access  Admin
 */
exports.createCategory = async (req, res) => {
  try {
    const {
      name,
      description,
      discount,
      featured,
      active,
      order
    } = req.body;
    
    // Check if category with same name already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }
    
    // Process uploaded image
    let imageData = {};
    if (req.file) {
      const result = await uploadToS3(req.file);
      imageData = {
        url: result.Location,
        public_id: result.Key,
        alt: name
      };
    }
    
    // Create new category
    const category = new Category({
      name,
      description,
      image: Object.keys(imageData).length > 0 ? imageData : undefined,
      discount: discount ? JSON.parse(discount) : undefined,
      featured: featured === 'true',
      active: active !== 'false', // Default to true unless explicitly set to false
      order: order ? Number(order) : 0,
      createdBy: req.user.id
    });
    
    // Save category
    await category.save();
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message
    });
  }
};

/**
 * @desc    Update a category
 * @route   PUT /api/categories/:id
 * @access  Admin
 */
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      discount,
      featured,
      active,
      order,
      removeImage
    } = req.body;
    
    // Find category
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // If name is being changed, check for duplicates
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }
    }
    
    // Process image
    if (req.file) {
      // Delete old image if exists
      if (category.image && category.image.public_id) {
        await deleteFromS3(category.image.public_id);
      }
      
      // Upload new image
      const result = await uploadToS3(req.file);
      category.image = {
        url: result.Location,
        public_id: result.Key,
        alt: name || category.name
      };
    } else if (removeImage === 'true' && category.image) {
      // Remove image if requested
      if (category.image.public_id) {
        await deleteFromS3(category.image.public_id);
      }
      category.image = undefined;
    }
    
    // Update basic fields
    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (discount) category.discount = JSON.parse(discount);
    if (featured !== undefined) category.featured = featured === 'true';
    if (active !== undefined) category.active = active === 'true';
    if (order !== undefined) category.order = Number(order);
    
    // Update audit
    category.updatedBy = req.user.id;
    
    // Save changes
    await category.save();
    
    res.json({
      success: true,
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a category
 * @route   DELETE /api/categories/:id
 * @access  Admin
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any products are using this category
    const productsUsingCategory = await Product.countDocuments({ 'category._id': id });

    if (productsUsingCategory > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category: ${productsUsingCategory} products are using this category`
      });
    }

    // Find category
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Delete image from S3 if exists
    if (category.image && category.image.public_id) {
      await deleteFromS3(category.image.public_id);
    }

    // Delete category
    await Category.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message
    });
  }
};

/**
 * @desc    Update category status (active/inactive)
 * @route   PUT /api/categories/:id/status
 * @access  Admin
 */
exports.updateCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    
    if (active === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Active status is required'
      });
    }
    
    const category = await Category.findByIdAndUpdate(
      id,
      { 
        active: Boolean(active),
        updatedBy: req.user.id
      },
      { new: true }
    );
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.json({
      success: true,
      message: `Category ${active ? 'activated' : 'deactivated'} successfully`,
      category
    });
  } catch (error) {
    console.error('Error updating category status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category status',
      error: error.message
    });
  }
};

/**
 * @desc    Toggle featured status
 * @route   PUT /api/categories/:id/feature
 * @access  Admin
 */
exports.toggleFeatureCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { featured } = req.body;
    
    if (featured === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Featured status is required'
      });
    }
    
    const category = await Category.findByIdAndUpdate(
      id,
      { 
        featured: Boolean(featured),
        updatedBy: req.user.id
      },
      { new: true }
    );
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.json({
      success: true,
      message: `Category ${featured ? 'marked as featured' : 'removed from featured'} successfully`,
      category
    });
  } catch (error) {
    console.error('Error updating featured status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update featured status',
      error: error.message
    });
  }
};

/**
 * @desc    Update category display order
 * @route   PUT /api/categories/:id/order
 * @access  Admin
 */
exports.updateCategoryOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { order } = req.body;
    
    if (order === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Orders value is required'
      });
    }
    
    const category = await Category.findByIdAndUpdate(
      id,
      { 
        order: Number(order),
        updatedBy: req.user.id
      },
      { new: true }
    );
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Category order updated successfully',
      category
    });
  } catch (error) {
    console.error('Error updating category order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category order',
      error: error.message
    });
  }
};

/**
 * @desc    Update category discount
 * @route   PUT /api/categories/:id/discount
 * @access  Admin
 */
exports.updateCategoryDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const { discount } = req.body;
    
    if (!discount) {
      return res.status(400).json({
        success: false,
        message: 'Discount data is required'
      });
    }
    
    let discountData;
    try {
      discountData = typeof discount === 'string' ? JSON.parse(discount) : discount;
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Invalid discount data format'
      });
    }
    
    const category = await Category.findByIdAndUpdate(
      id,
      { 
        discount: discountData,
        updatedBy: req.user.id
      },
      { new: true }
    );
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Category discount updated successfully',
      category
    });
  } catch (error) {
    console.error('Error updating category discount:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category discount',
      error: error.message
    });
  }
};