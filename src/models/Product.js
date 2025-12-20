const mongoose = require('mongoose');
const slugify = require('slugify');

// Define embedded schemas
const ImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  public_id: { type: String },
  alt: { type: String }
}, { _id: false });

const DimensionsSchema = new mongoose.Schema({
  length: { type: Number },
  width: { type: Number },
  height: { type: Number }
}, { _id: false });

const DiscountSchema = new mongoose.Schema({
  percentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  active: {
    type: Boolean,
    default: false
  },
  startDate: Date,
  endDate: Date
}, { _id: false });

// Main product schema
const productSchema = new mongoose.Schema({
  // Basic information
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  
  slug: {
    type: String,
    unique: true,
    lowercase: true,
  },
  
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  
  shortDescription: {
    type: String,
    maxlength: [300, 'Short description cannot exceed 300 characters']
  },
  
  // Price and inventory
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative']
  },
  
  quantity: {
    type: Number,
    required: [true, 'Product quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    default: 0
  },
  
  sold: {
    type: Number,
    default: 0
  },
  
  // Categorization - store embedded category data
  category: {
    _id: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product category is required']
    },
    name: { type: String, required: true },
    slug: { type: String, required: true }
  },
  
  subcategory: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subcategory' },
    name: String,
    slug: String
  },
  
  // Media
  images: [ImageSchema],
  
  // Discount system
  discount: {
    regular: DiscountSchema,
    subscription: {
      percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0// Default 10% discount for subscription users
      },
      active: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // SEO and marketing
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  },
  
  // Product details
  attributes: {
    type: Map,
    of: String,
    default: {}
  },
  
  // Shipping information
  shipping: {
    weight: { type: Number, default: 0 },
    dimensions: DimensionsSchema,
    freeShipping: { type: Boolean, default: false },
    shippingCost: { type: Number, default: 0 }
  },
  
  // Status flags
  status: {
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    inStock: { type: Boolean, default: true }
  },
  
  // Ratings and reviews
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  
  // Audit information
  audit: {
    createdBy: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String
    },
    updatedBy: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// AUTO UPDATE STATUS BASED ON QUANTITY
productSchema.pre('save', function(next) {
  // Update inStock status based on quantity
  this.status.inStock = this.quantity > 0;
  
  // Generate slug if name changed
  if (this.isModified('name')) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
    
    // Add a timestamp to ensure uniqueness for new products
    if (this.isNew) {
      this.slug += `-${Date.now().toString().substring(7)}`;
    }
  }
  
  next();
});

// VIRTUALS FOR PRICE CALCULATIONS
productSchema.virtual('finalPrice').get(function() {
  if (this.discount.regular.active) {
    const now = new Date();
    
    // Check if discount is within valid date range
    if ((!this.discount.regular.startDate || this.discount.regular.startDate <= now) && 
        (!this.discount.regular.endDate || this.discount.regular.endDate >= now)) {
      return parseFloat((this.price * (1 - this.discount.regular.percentage / 100)).toFixed(2));
    }
  }
  return this.price;
});

productSchema.virtual('subscriptionPrice').get(function() {
  // Start with the final price (after regular discount)
  let price = this.finalPrice;
  
  // Apply subscription discount if active
  if (this.discount.subscription.active) {
    price = parseFloat((price * (1 - this.discount.subscription.percentage / 100)).toFixed(2));
  }
  
  return price;
});

productSchema.virtual('subscriberSavings').get(function() {
  return parseFloat((this.finalPrice - this.subscriptionPrice).toFixed(2));
});

// METHOD TO CHECK STOCK STATUS
productSchema.methods.isInStock = function() {
  return this.quantity > 0;
};

// UPDATE 'inStock' STATUS AUTOMATICALLY
productSchema.pre('save', function(next) {
  if (this.isModified('quantity')) {
    this.status.inStock = this.quantity > 0;
  }
  next();
});

// INDEXES FOR PERFORMANCE OPTIMIZATION
// Text index for search
productSchema.index({ 
  name: 'text', 
  description: 'text',
  shortDescription: 'text',
  'seo.keywords': 'text'
}, {
  weights: {
    name: 10,
    'seo.keywords': 5,
    shortDescription: 3,
    description: 1
  }
});

// Compound indexes for common queries
productSchema.index({ 'category._id': 1, 'status.active': 1 });
productSchema.index({ 'status.featured': 1, 'status.active': 1 });
productSchema.index({ 'discount.regular.active': 1, 'status.active': 1 });
productSchema.index({ 'status.inStock': 1, 'status.active': 1 });
// Note: slug index is already defined in schema with `index: true`
productSchema.index({ price: 1 }); // For price filtering

// STATICS
productSchema.statics.findByCategory = function(categoryId) {
  return this.find({ 'category._id': categoryId, 'status.active': true });
};

productSchema.statics.findFeatured = function(limit = 10) {
  return this.find({ 'status.featured': true, 'status.active': true })
    .sort({ createdAt: -1 })
    .limit(limit);
};

productSchema.statics.findDiscounted = function(limit = 10) {
  return this.find({ 
    'discount.regular.active': true, 
    'status.active': true,
    'status.inStock': true
  })
  .sort({ 'discount.regular.percentage': -1 })
  .limit(limit);
};

module.exports = mongoose.model('Product', productSchema);