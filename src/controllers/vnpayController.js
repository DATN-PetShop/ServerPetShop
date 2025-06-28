const crypto = require('crypto');

exports.createVnpayPayment = (req, res) => {
  const vnpUrl = process.env.VNPAY_URL;
  const secretKey = process.env.VNPAY_SECRET_KEY;
  const vnpParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: process.env.VNPAY_TMN_CODE,
    vnp_Amount: req.body.amount * 100,
    vnp_CurrCode: 'VND',
    vnp_TxnRef: 'order_' + Date.now(),
    vnp_OrderInfo: 'Thanh toan don hang',
    vnp_OrderType: '250000',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: process.env.VNPAY_RETURN_URL,
    vnp_IpAddr: req.ip || '127.0.0.1',
    vnp_CreateDate: new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14),
  };

  const sortedParams = Object.keys(vnpParams).sort().reduce((acc, key) => {
    acc[key] = vnpParams[key];
    return acc;
  }, {});
  const signData = Object.keys(sortedParams)
    .map(key => `${key}=${encodeURIComponent(sortedParams[key]).replace(/%20/g, '+')}`)
    .join('&');
  const hmac = crypto.createHmac('sha512', secretKey);
  vnpParams.vnp_SecureHash = hmac.update(signData).digest('hex');

  const querystring = new URLSearchParams(vnpParams).toString();
  const paymentUrl = `${vnpUrl}?${querystring}`;
  res.json({ paymentUrl });
}; 