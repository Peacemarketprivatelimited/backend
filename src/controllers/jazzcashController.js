const crypto = require('crypto');
const Transaction = require("../models/Transaction");
const PendingTransaction = require("../models/PendingTransaction"); // New model needed
const User = require('../models/User');
const axios = require('axios');
const cron = require('node-cron');

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
            "https://payments.jazzcash.com.pk/ApplicationAPI/API/2.0/Purchase/DoMWalletTransaction",
            payload
        );

        console.log("✅ JazzCash Api Response:", response.data);

        // Instead of saving to Transaction directly, save to PendingTransaction
        await PendingTransaction.create({
            userId,
            pp_TxnRefNo: response.data.pp_TxnRefNo,
            pp_Amount: response.data.pp_Amount,
            pp_TxnCurrency: response.data.pp_TxnCurrency,
            pp_TxnDateTime: response.data.pp_TxnDateTime,
            pp_ResponseCode: response.data.pp_ResponseCode,
            raw: response.data,
            createdAt: new Date(),
            statusInquiryScheduledFor: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
        });

        console.log(`✅ Payment initiated, status inquiry scheduled in 30 seconds for ${response.data.pp_TxnRefNo}`);

        res.json(response.data);
    } catch (err) {
        console.error("❌ JazzCash payment error:", err.response?.data || err.message);
        res.status(500).json({ error: "Payment processing failed" });
    }
};

exports.checkTransactionStatus = async (req, res) => {
    try {
        const { transactionId } = req.params;

        if (!transactionId) {
            return res.status(400).json({
                success: false,
                error: "Transaction reference number is required"
            });
        }

        // Check if transaction exists in main Transaction collection
        let transaction = await Transaction.findOne({ pp_TxnRefNo: transactionId });

        // If not found in Transaction, check PendingTransaction
        if (!transaction) {
            const pendingTxn = await PendingTransaction.findOne({ pp_TxnRefNo: transactionId });

            if (!pendingTxn) {
                return res.status(404).json({
                    success: false,
                    error: "Transaction not found"
                });
            }

            // Check if 10 minutes have passed
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            if (pendingTxn.createdAt > tenMinutesAgo) {
                return res.json({
                    success: true,
                    status: 'waiting',
                    message: 'Please wait at least 30 seconds before checking status',
                    remainingTimeMs: pendingTxn.createdAt.getTime() + 10 * 60 * 1000 - Date.now()
                });
            }

            // If 10 minutes passed, proceed with status check
            const result = await checkJazzCashTransactionStatus(pendingTxn);

            // Return response based on the result
            if (result.transactionCreated) {
                // Transaction was moved from pending to confirmed
                transaction = await Transaction.findOne({ pp_TxnRefNo: transactionId });
                return res.json({
                    success: true,
                    status: transaction.status,
                    transaction: {
                        txnRef: transaction.pp_TxnRefNo,
                        amount: parseFloat(transaction.pp_Amount) / 100,
                        status: transaction.status
                    },
                    inquiryResponse: result.inquiryResponse
                });
            } else {
                return res.json({
                    success: true,
                    status: 'pending',
                    message: 'Transaction is still being processed',
                    inquiryResponse: result.inquiryResponse
                });
            }
        } else {
            // Transaction already exists in main collection, return its status
            return res.json({
                success: true,
                status: transaction.status,
                transaction: {
                    txnRef: transaction.pp_TxnRefNo,
                    amount: parseFloat(transaction.pp_Amount) / 100,
                    status: transaction.status
                }
            });
        }
    } catch (err) {
        console.error("❌ JazzCash status inquiry error:", err.response?.data || err.message);
        res.status(500).json({
            success: false,
            error: "Failed to check transaction status"
        });
    }
};

// Reusable helper function for checking transaction status
const checkJazzCashTransactionStatus = async (pendingTransaction) => {
    // Prepare request payload for Status Inquiry API
    const payload = {
        pp_TxnRefNo: pendingTransaction.pp_TxnRefNo,
        pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID,
        pp_Password: process.env.JAZZCASH_PASSWORD
    };

    // Get integrity salt
    const integritySalt = process.env.JAZZCASH_SALT;

    // Collect all pp_ fields for hash calculation
    const ppFields = {};
    Object.keys(payload).forEach(key => {
        if (key.startsWith('pp_')) {
            ppFields[key.toLowerCase()] = payload[key];
        }
    });

    // Sort keys alphabetically
    const sortedKeys = Object.keys(ppFields).sort();

    // Build hash string with salt prepended
    let hashString = integritySalt;
    sortedKeys.forEach(key => {
        hashString += '&' + ppFields[key];
    });

    // Calculate hash
    const hash = crypto
        .createHmac('sha256', integritySalt)
        .update(hashString)
        .digest('hex')
        .toUpperCase();

    payload.pp_SecureHash = hash;

    // API endpoint based on environment
    const apiUrl = 'https://payments.jazzcash.com.pk/ApplicationAPI/API/PaymentInquiry/Inquire';

    // Make API request
    const response = await axios.post(apiUrl, payload);
    console.log("✅ JazzCash Status Inquiry Response:", response.data);

    // Update transaction in database based on inquiry result
    let transactionCreated = false;

    if (response.data.pp_ResponseCode === '000') {
        let status;

        // Determine final status
        if (response.data.pp_PaymentResponseCode === '121' ||
            response.data.pp_Status === 'Completed') {
            status = 'success';
        } else if (response.data.pp_Status === 'Failed') {
            status = 'failed';
        } else {
            status = 'pending';
        }

        // If status is determined (success or failed), create transaction record
        if (status === 'success' || status === 'failed') {
            // Create transaction in main collection
            const transaction = await Transaction.create({
                userId: pendingTransaction.userId,
                pp_TxnRefNo: pendingTransaction.pp_TxnRefNo,
                pp_Amount: pendingTransaction.pp_Amount,
                pp_TxnCurrency: pendingTransaction.pp_TxnCurrency,
                pp_TxnDateTime: pendingTransaction.pp_TxnDateTime,
                pp_BillReference: pendingTransaction.raw.pp_BillReference,
                pp_Description: pendingTransaction.raw.pp_Description,
                pp_ResponseCode: response.data.pp_ResponseCode,
                pp_ResponseMessage: response.data.pp_ResponseMessage,
                pp_PaymentResponseCode: response.data.pp_PaymentResponseCode,
                pp_PaymentResponseMessage: response.data.pp_PaymentResponseMessage,
                pp_Status: response.data.pp_Status,
                pp_SecureHash: response.data.pp_SecureHash,
                status,
                raw: pendingTransaction.raw,
                statusInquiryResponse: response.data
            });

            // If successful, update user subscription
            // if (status === 'success' && pendingTransaction.userId) {
            //     const user = await User.findById(pendingTransaction.userId);
            //     if (user) {
            //         const purchaseDate = new Date();
            //         const expiryDate = new Date(purchaseDate);
            //         expiryDate.setDate(purchaseDate.getDate() + 180); // 180 days subscription

            //         if (!user.referralCode) {
            //             user.generateReferralCode();


            //         }

            //         user.subscription = {
            //             isActive: true,
            //             purchaseDate,
            //             expiryDate,
            //             amountPaid: parseFloat(pendingTransaction.pp_Amount) / 100,
            //             subscriptionId: pendingTransaction.pp_TxnRefNo
            //         };

            //         await user.save();
            //         console.log('✅ User subscription activated:', user._id);
            //     }
            // }
            if (status === 'success' && pendingTransaction.userId) {
                const user = await User.findById(pendingTransaction.userId);
                if (user) {
                    const purchaseDate = new Date();
                    const expiryDate = new Date(purchaseDate);
                    expiryDate.setDate(purchaseDate.getDate() + 180); // 180 days subscription

                    if (!user.referralCode) {
                        user.generateReferralCode();
                    }

                    user.subscription = {
                        isActive: true,
                        purchaseDate,
                        expiryDate,
                        amountPaid: parseFloat(pendingTransaction.pp_Amount) / 100,
                        subscriptionId: pendingTransaction.pp_TxnRefNo
                    };

                    await user.save();
                    console.log('✅ User subscription activated:', user._id);

                    // Process referral credits if the user was referred by someone
                    if (user.referredBy) {
                        const referralUtils = require('../utils/referralUtils');
                        await referralUtils.processReferralCredits(
                            user._id,
                            parseFloat(pendingTransaction.pp_Amount) / 100
                        );
                        console.log(`✅ Referral credits processed for user ${user._id}`);
                    }
                }
            }
            // Remove from pending transactions
            await PendingTransaction.deleteOne({ _id: pendingTransaction._id });
            transactionCreated = true;
        }
    }

    return {
        success: true,
        transactionCreated,
        inquiryResponse: response.data
    };
};

// Export the function to be used by cron job
exports.checkJazzCashTransactionStatus = checkJazzCashTransactionStatus;

// In jazzcashController.js
exports.checkPendingTransactions = async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`🔍 Checking pending transactions for user ${userId}`);
        // Check for pending transactions
        const pendingTxn = await PendingTransaction.findOne({ userId });

        if (pendingTxn) {
            return res.json({
                pending: true,
                transaction: {
                    pp_TxnRefNo: pendingTxn.pp_TxnRefNo,
                    pp_Amount: pendingTxn.pp_Amount,
                    createdAt: pendingTxn.createdAt
                }
            });
        }

        return res.json({ pending: false });
    } catch (err) {
        console.error("❌ Error checking pending transactions:", err);
        res.status(500).json({ error: "Failed to check pending transactions" });
    }
};