const crypto = require("crypto");

const integritySalt = "8z70cb1835"; // Your real salt
const merchantID = "MC152472";
const password = "t14gvs195y";

function buildJazzCashPayload(amount) {
    const txnRef = "T" + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const txnDateTime = txnRef.slice(1);
    const expiryDateTime = getExpiryDateTime();

    const data = {
        pp_Version: "1.1",
        pp_TxnType: "MWALLET",
        pp_Language: "EN",
        pp_MerchantID: merchantID,
        pp_Password: password,
        pp_TxnRefNo: txnRef,
        pp_Amount: (amount * 100).toString(), // e.g., 2000 => 200000
        pp_TxnCurrency: "PKR",
        pp_TxnDateTime: txnDateTime,
        pp_TxnExpiryDateTime: expiryDateTime,
        pp_BillReference: "PM-SUB-" + amount,
        pp_Description: "Peace Market Subscription",
        pp_ReturnURL: "https://peace-market.com/payment-callback",
        ppmpf_1: "meta1",
        ppmpf_2: "meta2",
        ppmpf_3: "",
        ppmpf_4: "",
        ppmpf_5: ""
    };

    // 💡 Step 1: Remove empty values
    const filtered = Object.entries(data)
        .filter(([_, value]) => value !== null && value !== undefined && value !== "")
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)); // 💡 Step 2: Sort keys

    // 💡 Step 3: Join values (NOT keys) with '&' after salt
    const hashString = integritySalt + '&' + filtered.map(([_, val]) => val).join('&');

    // 💡 Step 4: HMAC-SHA256 using salt as key
    const secureHash = crypto.createHmac("sha256", integritySalt)
        .update(hashString)
        .digest("hex")
        .toUpperCase();

    return {
        data: {
            ...data,
            pp_SecureHash: secureHash
        },
        postURL: "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/"
    };
}

function getExpiryDateTime() {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

module.exports = buildJazzCashPayload;
