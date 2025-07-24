const cron = require('node-cron');
const PendingTransaction = require('../models/PendingTransaction');
const { checkJazzCashTransactionStatus } = require('../controllers/jazzcashController');

// Setup cron job for checking pending transactions
const setupJazzCashStatusCheckCron = () => {
    // Run every 1 minute
    cron.schedule('*/1 * * * *', async () => {
        try {
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