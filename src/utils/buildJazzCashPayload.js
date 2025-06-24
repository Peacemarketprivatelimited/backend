const crypto = require("crypto");

function buildJazzCashPayload(amount) {
    const integritySalt = "8z70cb1835"; // your JazzCash integrity salt
    const merchantID = "MC152472";
    const password = "t14gvs195y";
    const returnURL = "https://peace-market.com/payment-callback";
    const txnRefNo = "T" + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const txnDateTime = txnRefNo.slice(1);
    const expiryDateTime = getExpiryDateTime();

    const data = {
        pp_Version: "1.1",
        pp_TxnType: "MWALLET",
        pp_Language: "EN",
        pp_MerchantID: merchantID,
        pp_SubMerchantID: "",
        pp_Password: password,
        pp_BankID: "TBANK",
        pp_ProductID: "RETL",
        pp_TxnRefNo: txnRefNo,
        pp_Amount: (amount * 100).toString(), // 2000 => 200000
        pp_TxnCurrency: "PKR",
        pp_TxnDateTime: txnDateTime,
        pp_TxnExpiryDateTime: expiryDateTime,
        pp_BillReference: "PM-SUB-" + amount,
        pp_Description: "Peace Market Subscription",
        pp_ReturnURL: returnURL,
        pp_DiscountedAmount: "",
        pp_DiscountBank: "",
        ppmpf_1: "1",
        ppmpf_2: "2",
        ppmpf_3: "3",
        ppmpf_4: "4",
        ppmpf_5: "5"
    };

    const hashString = integritySalt + "&" +
        data.pp_Amount + "&" +
        data.pp_BillReference + "&" +
        data.pp_Description + "&" +
        data.pp_Language + "&" +
        data.pp_MerchantID + "&" +
        data.pp_Password + "&" +
        data.pp_ReturnURL + "&" +
        data.pp_SubMerchantID + "&" +
        data.pp_TxnCurrency + "&" +
        data.pp_TxnDateTime + "&" +
        data.pp_TxnExpiryDateTime + "&" +
        data.pp_TxnRefNo + "&" +
        data.pp_TxnType + "&" +
        data.pp_Version + "&" +
        data.ppmpf_1 + "&" +
        data.ppmpf_2 + "&" +
        data.ppmpf_3 + "&" +
        data.ppmpf_4 + "&" +
        data.ppmpf_5;

    const hash = crypto.createHmac("sha256", integritySalt)
        .update(hashString)
        .digest("hex")
        .toUpperCase();

    data.pp_SecureHash = hash;

    return {
        data,
        postURL: "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/"
    };
}

function getExpiryDateTime() {
    const now = new Date();
    now.setHours(now.getHours() + 1); // +1 hour expiry
    return now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

module.exports = buildJazzCashPayload;
