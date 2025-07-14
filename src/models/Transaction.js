const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, // optional: ObjectId from User model
        required: false,
    },
    pp_TxnRefNo: String,
    pp_Amount: String,
    pp_TxnCurrency: String,
    pp_TxnDateTime: String,
    pp_BillReference: String,
    pp_Description: String,
    pp_ResponseCode: String,
    pp_ResponseMessage: String,
    pp_SecureHash: String,
    status: {
        type: String,
        enum: ['success', 'failed', 'pending'],
        default: 'failed',
    },
    raw: mongoose.Schema.Types.Mixed, // 🔍 full response body
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
