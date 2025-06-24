// backend/src/utils/buildJazzCashPayload.js
const crypto = require('crypto');

function buildJazzCashPayload(amount) {
    const merchantId = process.env.JAZZCASH_MERCHANT_ID;
    const password = process.env.JAZZCASH_PASSWORD;
    const integrityKey = process.env.JAZZCASH_INTEGRITY_KEY;
    const returnUrl = 'https://peace-market.com/payment-callback';

    const txnDateTime = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const txnExpiryDateTime = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const txnRefNo = `T${txnDateTime}`;

    const payload = {
        pp_Version: '1.1',
        pp_TxnType: 'MWALLET',
        pp_Language: 'EN',
        pp_MerchantID: merchantId,
        pp_SubMerchantID: '',
        pp_Password: password,
        pp_BankID: 'TBANK',
        pp_ProductID: 'RETL',
        pp_TxnRefNo: txnRefNo,
        pp_Amount: (amount * 100).toString(), // Convert to paisa
        pp_TxnCurrency: 'PKR',
        pp_TxnDateTime: txnDateTime,
        pp_BillReference: `PM-SUB-${amount}`,
        pp_Description: 'Peace Market Subscription',
        pp_TxnExpiryDateTime: txnExpiryDateTime,
        pp_ReturnURL: returnUrl,
        pp_SecureHash: '',
        ppmpf_1: 'meta1',
        ppmpf_2: 'meta2',
        ppmpf_3: '',
        ppmpf_4: '',
        ppmpf_5: '',
    };

    const hashStringParts = [];

    Object.keys(payload)
        .sort()
        .forEach(key => {
            if (key !== 'pp_SecureHash' && payload[key] !== '') {
                hashStringParts.push(payload[key]);
            }
        });

    const concatenated = hashStringParts.join('&') + '&' + integrityKey;

    payload.pp_SecureHash = crypto
        .createHash('sha256')
        .update(concatenated)
        .digest('hex')
        .toUpperCase();

    return payload;
}

module.exports = buildJazzCashPayload;
