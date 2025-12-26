const cron = require('node-cron');
const mongoose = require('mongoose');
const PendingTransaction = require('../models/PendingTransaction');
const { checkJazzCashTransactionStatus } = require('../controllers/jazzcashController');
const logger = require('./logger');

let lastMongoDisconnectedLogAt = 0;
let lastMongoConnErrorLogAt = 0;

function shouldLogMongoDisconnected(nowMs) {
    // Avoid flooding logs if Mongo is down; log at most once per 5 minutes.
    const fiveMinutesMs = 5 * 60 * 1000;
    if (nowMs - lastMongoDisconnectedLogAt >= fiveMinutesMs) {
        lastMongoDisconnectedLogAt = nowMs;
        return true;
    }
    return false;
}

function shouldLogMongoConnError(nowMs) {
    // Log at most once per 5 minutes for connection-level Mongo errors.
    const fiveMinutesMs = 5 * 60 * 1000;
    if (nowMs - lastMongoConnErrorLogAt >= fiveMinutesMs) {
        lastMongoConnErrorLogAt = nowMs;
        return true;
    }
    return false;
}

function isMongoConnRefused(err) {
    const msg = err?.message || '';
    return (
        msg.includes('ECONNREFUSED') ||
        msg.includes('MongoNetworkError') ||
        msg.includes('Topology is closed') ||
        msg.includes('Client must be connected')
    );
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
                    logger.error(
                        `Skipping JazzCash cron job: MongoDB not connected (readyState=${mongoose.connection.readyState})`
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

            logger.info(`JazzCash cron: found ${pendingTransactions.length} pending transaction(s) to check`);

            // Process each pending transaction
            for (const pendingTxn of pendingTransactions) {
                try {
                    logger.info(`JazzCash cron: checking transaction ${pendingTxn.pp_TxnRefNo}`);
                    await checkJazzCashTransactionStatus(pendingTxn);
                } catch (err) {
                    logger.error(
                        `JazzCash cron: error checking transaction ${pendingTxn.pp_TxnRefNo}`,
                        { message: err?.message }
                    );

                    // Update last checked time and reschedule for next check
                    pendingTxn.lastChecked = new Date();
                    pendingTxn.statusInquiryScheduledFor = new Date(Date.now() + 5 * 60 * 1000); // retry in 5 minutes
                    await pendingTxn.save();
                }
            }
        } catch (err) {
            const nowMs = Date.now();
            if (isMongoConnRefused(err)) {
                if (shouldLogMongoConnError(nowMs)) {
                    logger.error('JazzCash cron: MongoDB connection error', { message: err?.message });
                }
                return;
            }

            logger.error('JazzCash cron: unexpected error', { message: err?.message });
        }
    });

    logger.info('✅ JazzCash transaction status check cron job scheduled');
    logger.info('JazzCash cron scheduled (cronJobs v2)');
};

module.exports = { setupJazzCashStatusCheckCron };

// Optional: set up nightly aggregates for challenge events
const setupChallengeAggregateCron = () => {
    const ChallengeEvent = require('../models/ChallengeEvent');
    const cron = require('node-cron');
    const mongoose = require('mongoose');
    const logger = require('./logger');

    // run once daily at 00:05
    cron.schedule('5 0 * * *', async () => {
        try {
            if (mongoose.connection.readyState !== 1) return;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);
            const today = new Date(yesterday);
            today.setDate(yesterday.getDate() + 1);

            const agg = await ChallengeEvent.aggregate([
                { $match: { createdAt: { $gte: yesterday, $lt: today } } },
                { $group: { _id: '$day', claims: { $sum: 1 }, points: { $sum: '$points' } } }
            ]);

            logger.info('Challenge aggregate (yesterday)', { date: yesterday.toISOString(), data: agg });
            // Optionally persist to a collection for dashboards
        } catch (err) {
            logger.error('Challenge aggregate cron error', { message: err?.message });
        }
    });

    logger.info('✅ Challenge aggregate cron scheduled (daily at 00:05)');
};

module.exports = { setupJazzCashStatusCheckCron, setupChallengeAggregateCron };