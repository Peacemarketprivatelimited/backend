const Product = require('../models/Product');
const Category = require('../models/Category');
const { uploadToS3, deleteFromS3 } = require('../utils/s3Utils');
const mongoose = require('mongoose');

/**
 * @desc    Get all products with filtering, sorting, and pagination
 * @route   GET /api/products
 * @access  Public
 */
exports.getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      sort = 'createdAt',
      order = 'desc',
      category,
      minPrice,
      maxPrice,
      inStock,
      featured
    } = req.query;

    // Build filter object
    const filter = { 'status.active': true };
    
    // Category filter
    if (category) {
      filter['category._id'] = mongoose.Types.ObjectId(category);
    }
    
    // Price filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    
    // Stock filter
    if (inStock === 'true') {
      filter['status.inStock'] = true;
    }
    
    // Featured filter
    if (featured === 'true') {
      filter['status.featured'] = true;
    }

    // Execute query with pagination
    const products = await Product.find(filter)
      .sort({ [sort]: order === 'desc' ? -1 : 1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    // Get total documents count
    const total = await Product.countDocuments(filter);
    
    // Check if user has subscription to include subscription prices
    const isSubscriber = req.user && req.user.subscription && req.user.subscription.isActive;

    res.json({
      success: true,
      products,
      isSubscriber,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
};

/**
 * @desc    Get featured products
 * @route   GET /api/products/featured
 * @access  Public
 */
exports.getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 8 } = req.query;
    
    const products = await Product.findFeatured(Number(limit));
    
    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured products',
      error: error.message
    });
  }
};

/**
 * @desc    Get discounted products
 * @route   GET /api/products/discounted
 * @access  Public
 */
exports.getDiscountedProducts = async (req, res) => {
  try {
    const { limit = 8 } = req.query;
    
    const products = await Product.findDiscounted(Number(limit));
    
    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Error fetching discounted products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discounted products',
      error: error.message
    });
  }
};

/**
 * @desc    Get products by category
 * @route   GET /api/products/category/:categoryId
 * @access  Public
 */
exports.getProductsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 12 } = req.query;
    
    const products = await Product.findByCategory(categoryId)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    
    // Get total documents count
    const total = await Product.countDocuments({ 
      'category._id': categoryId, 
      'status.active': true 
    });
    
    res.json({
      success: true,
      products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products by category',
      error: error.message
    });
  }
};

/**
 * @desc    Search products
 * @route   GET /api/products/search
 * @access  Public
 */
exports.searchProducts = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    const products = await Product.find({
      $text: { $search: q },
      'status.active': true
    })
    .sort({ score: { $meta: 'textScore' } })
    .limit(20);
    
    res.json({
      success: true,
      products,
      query: q
    });
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search products',
      error: error.message
    });
  }
};

/**
 * @desc    Get product by slug
 * @route   GET /api/products/:slug
 * @access  Public
 */
exports.getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const product = await Product.findOne({
      slug,
      'status.active': true
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check if user has subscription to include subscription prices
    const isSubscriber = req.user && req.user.subscription && req.user.subscription.isActive;
    
    res.json({
      success: true,
      product,
      isSubscriber
    });
  } catch (error) {
    console.error('Error fetching product by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message
    });
  }
};

/**
 * @desc    Get product by ID
 * @route   GET /api/products/id/:id
 * @access  Public
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findOne({
      _id: id,
      'status.active': true
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check if user has subscription to include subscription prices
    const isSubscriber = req.user && req.user.subscription && req.user.subscription.isActive;
    
    res.json({
      success: true,
      product,
      isSubscriber
    });
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message
    });
  }
};

/**
 * @desc    Create a new product
 * @route   POST /api/products
 * @access  Admin
 */
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      shortDescription,
      price,
      quantity,
      categoryId,
      subcategoryId,
      discount,
      seo,
      attributes,
      shipping,
      status
    } = req.body;
    
    // Find the category to embed its data
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Process uploaded images
    const images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToS3(file);
        images.push({
          url: result.Location,
          public_id: result.Key,
          alt: name
        });
      }
    }
    
    // Create new product
    const product = new Product({
      name,
      description,
      shortDescription,
      price: Number(price),
      quantity: Number(quantity),
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug
      },
      images,
      discount: discount ? JSON.parse(discount) : undefined,
      seo: seo ? JSON.parse(seo) : undefined,
      attributes: attributes ? JSON.parse(attributes) : undefined,
      shipping: shipping ? JSON.parse(shipping) : undefined,
      status: status ? JSON.parse(status) : undefined,
      audit: {
        createdBy: {
          _id: req.user.id,
          name: req.user.name
        }
      }
    });
    
    // Add subcategory if provided
    if (subcategoryId) {
      const subcategory = await Subcategory.findById(subcategoryId);
      if (subcategory) {
        product.subcategory = {
          _id: subcategory._id,
          name: subcategory.name,
          slug: subcategory.slug
        };
      }
    }
    
    // Save product
    await product.save();
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message
    });
  }
};

/**
 * @desc    Update a product
 * @route   PUT /api/products/:id
 * @access  Admin
 */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      shortDescription,
      price,
      quantity,
      categoryId,
      subcategoryId,
      discount,
      seo,
      attributes,
      shipping,
      status,
      removeImages
    } = req.body;
    
    // Find product
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Update category if provided
    if (categoryId && String(product.category._id) !== categoryId) {
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
      
      product.category = {
        _id: category._id,
        name: category.name,
        slug: category.slug
      };
    }
    
    // Update subcategory if provided
    if (subcategoryId) {
      const subcategory = await Subcategory.findById(subcategoryId);
      if (subcategory) {
        product.subcategory = {
          _id: subcategory._id,
          name: subcategory.name,
          slug: subcategory.slug
        };
      }
    } else if (subcategoryId === "") {
      // Remove subcategory
      product.subcategory = undefined;
    }
    
    // Process uploaded images
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToS3(file);
        product.images.push({
          url: result.Location,
          public_id: result.Key,
          alt: product.name
        });
      }
    }
    
    // Remove images if specified
    if (removeImages) {
      const imagesToRemove = removeImages.split(',');
      for (const imgId of imagesToRemove) {
        const imageIndex = product.images.findIndex(img => String(img._id) === imgId);
        if (imageIndex !== -1) {
          const image = product.images[imageIndex];
          // Delete from S3
          if (image.public_id) {
            await deleteFromS3(image.public_id);
          }
          // Remove from product
          product.images.splice(imageIndex, 1);
        }
      }
    }
    
    // Update basic fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (shortDescription) product.shortDescription = shortDescription;
    if (price) product.price = Number(price);
    if (quantity !== undefined) product.quantity = Number(quantity);
    
    // Update complex objects
    if (discount) product.discount = JSON.parse(discount);
    if (seo) product.seo = JSON.parse(seo);
    if (attributes) product.attributes = JSON.parse(attributes);
    if (shipping) product.shipping = JSON.parse(shipping);
    if (status) product.status = JSON.parse(status);
    
    // Set audit info
    product.audit.updatedBy = {
      _id: req.user.id,
      name: req.user.name
    };
    
    // Save updated product
    await product.save();
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a product
 * @route   DELETE /api/products/:id
 * @access  Admin
 */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Delete images from S3
    for (const image of product.images) {
      if (image.public_id) {
        await deleteFromS3(image.public_id);
      }
    }
    
    // Delete product
    await product.remove();
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message
    });
  }
};

/**
 * @desc    Update product status (active/inactive)
 * @route   PUT /api/products/:id/status
 * @access  Admin
 */
exports.updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    
    if (active === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Active status is required'
      });
    }
    
    const product = await Product.findByIdAndUpdate(
      id,
      { 'status.active': Boolean(active) },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: `Product ${active ? 'activated' : 'deactivated'} successfully`,
      product
    });
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product status',
      error: error.message
    });
  }
};

/**
 * @desc    Toggle featured status
 * @route   PUT /api/products/:id/feature
 * @access  Admin
 */
exports.toggleFeatureProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { featured } = req.body;
    
    if (featured === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Featured status is required'
      });
    }
    
    const product = await Product.findByIdAndUpdate(
      id,
      { 'status.featured': Boolean(featured) },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: `Product ${featured ? 'marked as featured' : 'removed from featured'} successfully`,
      product
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
 * @desc    Add images to product
 * @route   POST /api/products/:id/images
 * @access  Admin
 */
exports.addProductImages = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded'
      });
    }
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Process and upload images
    for (const file of req.files) {
      const result = await uploadToS3(file);
      product.images.push({
        url: result.Location,
        public_id: result.Key,
        alt: product.name
      });
    }
    
    await product.save();
    
    res.json({
      success: true,
      message: 'Images added successfully',
      images: product.images
    });
  } catch (error) {
    console.error('Error adding images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add images',
      error: error.message
    });
  }
};

/**
 * @desc    Remove image from product
 * @route   DELETE /api/products/:id/images/:imageId
 * @access  Admin
 */
exports.removeProductImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Find the image in product
    const imageIndex = product.images.findIndex(img => String(img._id) === imageId);
    
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }
    
    // Get image to delete
    const imageToDelete = product.images[imageIndex];
    
    // Remove from S3
    if (imageToDelete.public_id) {
      await deleteFromS3(imageToDelete.public_id);
    }
    
    // Remove from product
    product.images.splice(imageIndex, 1);
    await product.save();
    
    res.json({
      success: true,
      message: 'Image removed successfully',
      images: product.images
    });
  } catch (error) {
    console.error('Error removing image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove image',
      error: error.message
    });
  }
};