
const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true,
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  image: {
    url: String,
    public_id: String,
    alt: String
  },
  
  // Discount configuration for this category
  discount: {
    regular: {
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
    },
    subscription: {
      percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 10
      },
      active: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // Status
  featured: {
    type: Boolean,
    default: false
  },
  
  active: {
    type: Boolean,
    default: true
  },
  
  // For managing display order
  order: {
    type: Number,
    default: 0
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Generate slug before saving
categorySchema.pre('save', function(next) {
  if (!this.isModified('name')) return next();
  
  this.slug = slugify(this.name, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });
  
  next();
});

// Find active categories
categorySchema.statics.findActive = function() {
  return this.find({ active: true }).sort({ order: 1, name: 1 });
};

// Find featured categories
categorySchema.statics.findFeatured = function(limit = 5) {
  return this.find({ featured: true, active: true })
    .sort({ order: 1, name: 1 })
    .limit(limit);
};

module.exports = mongoose.model('Category', categorySchema);