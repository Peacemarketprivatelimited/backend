const express = require('express');
const router = express.Router();
const { processPayment } = require('../controllers/jazzcashController');

router.post('/process-payment', processPayment);

module.exports = router;
