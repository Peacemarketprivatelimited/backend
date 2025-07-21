const crypto = require('crypto');
const Transaction = require("../models/Transaction")
const User = require('../models/User');
const axios = require('axios');

exports.processPayment = async (req, res) => {
    try {
        const payload = req.body;
        const userId = payload.ppmpf_1 || null;

        // Set credentials
        payload.pp_MerchantID = process.env.JAZZCASH_MERCHANT_ID;
        payload.pp_Password = process.env.JAZZCASH_PASSWORD;
        payload.ppmpf_1 = '';

        // Get integrity salt
        const integritySalt = process.env.JAZZCASH_SALT;

        // Collect all pp_ fields (except pp_SecureHash)
        const ppFields = {};
        Object.keys(payload).forEach(key => {
            if ((key.startsWith('pp_')) &&
                key !== 'pp_SecureHash' &&
                payload[key] !== undefined &&
                payload[key] !== null) {
                ppFields[key.toLowerCase()] = payload[key]; // Convert keys to lowercase for sorting
            }
        });

        // Sort keys alphabetically by ASCII value
        const sortedKeys = Object.keys(ppFields).sort();

        // Build values-only string (no keys)
        let hashString = integritySalt;
        sortedKeys.forEach(key => {
            hashString += '&' + ppFields[key];
        });

        // Calculate hash with salt as key
        const hash = crypto
            .createHmac('sha256', integritySalt)
            .update(hashString)
            .digest('hex')
            .toUpperCase();

        payload.pp_SecureHash = hash;

        // Make API request
        const response = await axios.post(
            "https://sandbox.jazzcash.com.pk/ApplicationAPI/API/2.0/Purchase/DoMWalletTransaction",
            payload
        );

        console.log("✅ JazzCash Api Response:", response.data);

        // Save transaction to DB
        let status = 'failed';
        if (response.data.pp_ResponseCode === '000') status = 'success';
        else if (response.data.pp_ResponseCode === '124' || response.data.pp_ResponseCode === '125') status = 'pending';

        // Save transaction
        await Transaction.create({
            userId,
            pp_TxnRefNo: response.data.pp_TxnRefNo,
            pp_Amount: response.data.pp_Amount,
            pp_TxnCurrency: response.data.pp_TxnCurrency,
            pp_TxnDateTime: response.data.pp_TxnDateTime,
            pp_BillReference: response.data.pp_BillReference,
            pp_Description: response.data.pp_Description,
            pp_ResponseCode: response.data.pp_ResponseCode,
            pp_ResponseMessage: response.data.pp_ResponseMessage,
            pp_SecureHash: response.data.pp_SecureHash,
            status,
            raw: response.data,
        });

        // ✅ Update user subscription if success
        if (status === 'success' && userId) {
            const user = await User.findById(userId);
            if (user) {
                const purchaseDate = new Date();
                const expiryDate = new Date(purchaseDate);
                expiryDate.setDate(purchaseDate.getDate() + 180); // valid for 30 days

                // Only generate referral code if it's not already there
                if (!user.referralCode) {
                    user.generateReferralCode(); // 👈 call method from schema
                }

                // Update subscription
                user.subscription = {
                    isActive: true,
                    purchaseDate,
                    expiryDate,
                    amountPaid: parseFloat(response.data.pp_Amount) / 100, // if stored in paisa
                    subscriptionId: response.data.pp_TxnRefNo
                };

                await user.save(); // Save changes including referralCode and subscription
                console.log('✅ User updated with subscription and referral code:', user.referralCode);
            }
        }

        res.json(response.data);
    } catch (err) {
        console.error("❌ JazzCash payment error:", err.response?.data || err.message);
        res.status(500).json({ error: "Payment processing failed" });
    }
};