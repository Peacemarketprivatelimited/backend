const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: String,
  actualPrice: { type: Number, required: true },      // original price (no discount)
  discountedPrice: { type: Number, required: true },  // price after discount
  discount: { type: Number, required: true },         // actualPrice - discountedPrice
  quantity: { type: Number, required: true }

}, { _id: false });

const OrderSchema = new mongoose.Schema({
  guest: {
    name: { type: String },
    email: { type: String }
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [OrderItemSchema],
  orderNumber: { type: String, unique: true, required: true },

  shippingAddress: { type: String, required: true },
  billingAddress: {
    sameAsShipping: { type: Boolean, default: true },
    address: { type: String, required: true }
  },
  payment: {
    method: { type: String, required: true },
    status: { type: String, default: 'pending' }
  },
  subtotal: { type: Number, required: true },       // sum of price * qty (full prices)
  shipping: { type: Number, default: 0 },
  total: { type: Number, required: true },          // subtotal + shipping (no subscription discount applied here)
  notes: String,
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  phoneNumber: { type: String, required: true },

  // Wallet credit audit
  walletCredit: {
    amount: { type: Number, default: 0 },           // total credited to user wallet for this order
    credited: { type: Boolean, default: false },     // prevents double-credit
    creditedAt: { type: Date }
  },

  // optional statuses (adjust to your schema)
  paymentMethod: { type: String, default: 'COD' },
  paymentStatus: { type: String, default: 'pending' } // pending | paid | failed
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);