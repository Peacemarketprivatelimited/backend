const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderItemSchema = new Schema({
  product: {
    _id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    slug: String,
    price: { type: Number, required: true },
    image: {
      url: String,
      alt: String
    }
  },
  quantity: { type: Number, required: true, min: [1, 'Quantity cannot be less than 1'] },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true }
}, { _id: false });

const orderSchema = new Schema({
  // user: { type: Object, required: false, default: null }, // optional or remove
  items: [orderItemSchema],
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
  subtotal: { type: Number, required: true },
  shippingCost: { type: Number, required: true, default: 0 },
  tax: { type: Number, required: true, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  notes: String,
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  phoneNumber: { type: String, required: true },

}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;