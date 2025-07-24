const express = require('express');
const router = express.Router();
const { processPayment, checkTransactionStatus, checkPendingTransactions} = require('../controllers/jazzcashController');

router.post('/process-payment', processPayment);
router.get('/check-status/:transactionId', checkTransactionStatus);
router.get('/pending-transactions/:userId', checkPendingTransactions);

module.exports = router;
