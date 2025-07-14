const crypto = require('crypto');
const Transaction = require("../models/Transaction")

const INTEGRITY_SALT = process.env.JAZZCASH_SALT;

exports.generateHash = (req, res) => {
    try {
        const fields = req.body;

        // Replace empty pp_MerchantID and pp_Password with environment ones
        fields.pp_MerchantId = process.env.JAZZCASH_MERCHANT_ID;
        fields.pp_Password = process.env.JAZZCASH_PASSWORD;

        console.log(fields.pp_TxnDateTime);

        const sortedKeys = Object.keys(fields).filter(k => fields[k] !== '').sort();
        const hashString = INTEGRITY_SALT + '&' + sortedKeys.map(k => fields[k]).join('&');

        const hash = crypto
            .createHmac('sha256', INTEGRITY_SALT)
            .update(hashString)
            .digest('hex')
            .toUpperCase();

        res.json({ hash, hashString, fields });
    } catch (err) {
        console.error('Hash generation error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const User = require('../models/User'); // or your user model path

exports.handlePaymentCallback = async (req, res) => {
    try {
        console.log('✅ JazzCash Payment Callback Hit');
        console.log('🔍 POST Body:', req.body);

        const body = req.body;
        const userId = body.ppmpf_1 || null;

        let status = 'failed';
        if (body.pp_ResponseCode === '000') status = 'success';
        else if (body.pp_ResponseCode === '124' || body.pp_ResponseCode === '125') status = 'pending';

        // Save transaction
        await Transaction.create({
            userId,
            pp_TxnRefNo: body.pp_TxnRefNo,
            pp_Amount: body.pp_Amount,
            pp_TxnCurrency: body.pp_TxnCurrency,
            pp_TxnDateTime: body.pp_TxnDateTime,
            pp_BillReference: body.pp_BillReference,
            pp_Description: body.pp_Description,
            pp_ResponseCode: body.pp_ResponseCode,
            pp_ResponseMessage: body.pp_ResponseMessage,
            pp_SecureHash: body.pp_SecureHash,
            status,
            raw: body,
        });

        // ✅ Update user subscription if success
        if (status === 'success' && userId) {
            const user = await User.findById(userId);
            if (user) {
                const purchaseDate = new Date();
                const expiryDate = new Date(purchaseDate);
                expiryDate.setDate(purchaseDate.getDate() + 30); // valid for 30 days

                // Only generate referral code if it's not already there
                if (!user.referralCode) {
                    user.generateReferralCode(); // 👈 call method from schema
                }

                // Update subscription
                user.subscription = {
                    isActive: true,
                    purchaseDate,
                    expiryDate,
                    amountPaid: parseFloat(body.pp_Amount) / 100, // if stored in paisa
                    subscriptionId: body.pp_TxnRefNo
                };

                await user.save(); // Save changes including referralCode and subscription
                console.log('✅ User updated with subscription and referral code:', user.referralCode);
            }
        }

        // Redirect to frontend with payment result
        const frontendURL = `https://peace-market.com/payment-callback?status=${status}&txnRef=${body.pp_TxnRefNo}&amount=${body.pp_Amount}&message=${encodeURIComponent(body.pp_ResponseMessage || '')}`;
        res.redirect(frontendURL);

    } catch (error) {
        console.error('❌ Payment callback error:', error);
        res.status(500).send('Internal server error');
    }
};

