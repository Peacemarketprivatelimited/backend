const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderItemSchema = new Schema({
  product: {
    _id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    slug: String,
    price: {
      type: Number,
      required: true
    },
    image: {
      url: String,
      alt: String
    }
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity cannot be less than 1']
  },
  price: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  totalPrice: {
    type: Number,
    required: true
  }
}, { _id: false });

const addressSchema = new Schema({
  fullName: {
    type: String,
    required: true
  },
  addressLine1: {
    type: String,
    required: true
  },
  addressLine2: String,
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  postalCode: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true,
    default: 'United States'
  },
  phone: {
    type: String,
    required: true
  }
}, { _id: false });

const paymentSchema = new Schema({
  method: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'stripe', 'bank_transfer', 'cod'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  transactionId: String,
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  provider: String,
  lastFour: String, // Last 4 digits of card
  paidAt: Date
}, { _id: false });

const orderSchema = new Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    _id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  items: [orderItemSchema],
  shippingAddress: addressSchema,
  billingAddress: {
    sameAsShipping: {
      type: Boolean,
      default: true
    },
    address: addressSchema
  },
  payment: paymentSchema,
  subtotal: {
    type: Number,
    required: true
  },
  shippingCost: {
    type: Number,
    required: true,
    default: 0
  },
  tax: {
    type: Number,
    required: true,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  trackingNumber: String,
  trackingUrl: String,
  notes: String,
  shippedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  refundedAt: Date,
  isSubscriptionOrder: {
    type: Boolean,
    default: false
  },
  subscriptionId: {
    type: Schema.Types.ObjectId,
    ref: 'Subscription'
  }
}, {
  timestamps: true
});

// Generate unique order number before saving
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await mongoose.model('Order').countDocuments();
    const date = new Date();
    this.orderNumber = `ORD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Virtual for order age
orderSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Add index for searching
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ 'user._id': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;