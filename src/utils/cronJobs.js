const cron = require('node-cron');
const mongoose = require('mongoose');
const PendingTransaction = require('../models/PendingTransaction');
const { checkJazzCashTransactionStatus } = require('../controllers/jazzcashController');

let lastMongoDisconnectedLogAt = 0;

function shouldLogMongoDisconnected(nowMs) {
    // Avoid flooding logs if Mongo is down; log at most once per 5 minutes.
    const fiveMinutesMs = 5 * 60 * 1000;
    if (nowMs - lastMongoDisconnectedLogAt >= fiveMinutesMs) {
        lastMongoDisconnectedLogAt = nowMs;
        return true;
    }
    return false;
}

// Setup cron job for checking pending transactions
const setupJazzCashStatusCheckCron = () => {
    // Run every 1 minute
    cron.schedule('*/1 * * * *', async () => {
        try {
            // If MongoDB is temporarily down/restarting, skip this run.
            // mongoose.connection.readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
            if (mongoose.connection.readyState !== 1) {
                const nowMs = Date.now();
                if (shouldLogMongoDisconnected(nowMs)) {
                    console.error(
                        `❌ Skipping JazzCash cron job: MongoDB not connected (readyState=${mongoose.connection.readyState})`
                    );
                }
                return;
            }

            // Find pending transactions that are scheduled for status inquiry
            const now = new Date();
            const pendingTransactions = await PendingTransaction.find({
                statusInquiryScheduledFor: { $lte: now }
            });

            if (pendingTransactions.length === 0) return;

            console.log(`🔍 Found ${pendingTransactions.length} pending transaction(s) to check`);

            // Process each pending transaction
            for (const pendingTxn of pendingTransactions) {
                try {
                    console.log(`🔄 Checking transaction ${pendingTxn.pp_TxnRefNo}`);
                    await checkJazzCashTransactionStatus(pendingTxn);
                } catch (err) {
                    console.error(`❌ Error checking transaction ${pendingTxn.pp_TxnRefNo}:`, err.message);

                    // Update last checked time and reschedule for next check
                    pendingTxn.lastChecked = new Date();
                    pendingTxn.statusInquiryScheduledFor = new Date(Date.now() + 5 * 60 * 1000); // retry in 5 minutes
                    await pendingTxn.save();
                }
            }
        } catch (err) {
            console.error('❌ Error in JazzCash cron job:', err.message);
        }
    });

    console.log('✅ JazzCash transaction status check cron job scheduled');
};

module.exports = { setupJazzCashStatusCheckCron };