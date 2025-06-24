const buildJazzCashPayload = require("../utils/buildJazzCashPayload");

exports.purchaseSubscription = async (req, res) => {
    try {
        const { paymentMethod, amount } = req.body;

        if (paymentMethod !== "JazzCash Wallet") {
            return res.status(400).json({ message: "Unsupported payment method" });
        }

        const response = buildJazzCashPayload(amount);
        return res.status(200).json(response);
    } catch (err) {
        console.error("Payment error:", err);
        res.status(500).json({ message: "Internal server error" });
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
