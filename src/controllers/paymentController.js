// backend/src/controllers/paymentController.js
const buildJazzCashPayload = require("../utils/buildJazzCashPayload");

exports.purchaseSubscription = async (req, res) => {
    try {
        const { paymentMethod, amount } = req.body;
        console.log("Payment request:", paymentMethod, amount);

        if (paymentMethod === 'JazzCash Wallet') {
            const payload = buildJazzCashPayload(amount);
            const postURL = 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform';

            return res.json({
                success: true,
                data: payload,
                postURL
            });
        }

        // Fallback (for other methods if needed)
        res.json({
            success: true,
            subscription: {
                referralCode: 'FAKE1234'
            }
        });
    } catch (error) {
        console.error("Payment processing error:", error);
        res.status(500).json({
            success: false,
            message: "Payment processing failed",
            error: error.message
        });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const { transactionId } = req.body;
        console.log("Verifying transaction:", transactionId);

        // Ideally: Hit JazzCash API to verify. For now, assume success.
        res.json({
            success: true,
            message: "Payment verified successfully",
            referralCode: "PM" + Math.random().toString(36).substring(2, 8).toUpperCase()
        });
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({
            success: false,
            message: "Payment verification failed",
            error: error.message
        });
    }
};
