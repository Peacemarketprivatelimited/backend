const mongoose = require('mongoose');

const PendingTransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    pp_TxnRefNo: {
        type: String,
        required: true,
        unique: true
    },
    pp_Amount: {
        type: String,
        required: true
    },
    pp_TxnCurrency: String,
    pp_TxnDateTime: String,
    pp_ResponseCode: String,
    raw: Object,
    createdAt: {
        type: Date,
        default: Date.now
    },
    statusInquiryScheduledFor: {
        type: Date,
        required: true
    },
    lastChecked: Date
});

module.exports = mongoose.model('PendingTransaction', PendingTransactionSchema);