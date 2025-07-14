const express = require('express');
const router = express.Router();
const { generateHash, handlePaymentCallback} = require('../controllers/jazzcashController');

router.post('/generate-hash', generateHash);

// router.post('/payment-callback', (req, res) => {
//     console.log('✅ JazzCash Payment Callback Hit');
//     console.log('🔍 POST Body:', req.body);
//
//     // TODO: Save payment result to DB if needed
//
//     // Redirect user to your frontend thank-you page
//     res.redirect('https://908f4a12761a.ngrok-free.app/payment-callback');
// });

router.post('/payment-callback', handlePaymentCallback);

module.exports = router;
