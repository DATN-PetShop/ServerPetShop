const crypto = require('crypto');
const Order = require('../models/Order');

const handleVnpayReturn = async (req, res) => {
  try {
    const vnpayData = req.query;
    const secretKey = process.env.VNPAY_SECRET_KEY;

    if (!verifyVnpaySignature(vnpayData, secretKey)) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    if (vnpayData.vnp_ResponseCode !== '00' || vnpayData.vnp_TransactionStatus !== '00') {
      return res.status(400).json({ message: 'Payment failed' });
    }

    const order = new Order({
      total_amount: vnpayData.vnp_Amount / 100,
      status: 'completed',
      payment_method: 'vnpay',
      vnpay_transaction_id: vnpayData.vnp_TxnRef,
      payment_date: vnpayData.vnp_PayDate,
      user_id: req.user.userId // Giả sử bạn có middleware xác thực
    });

    const savedOrder = await order.save();
    res.status(200).json({ message: 'Order saved', data: savedOrder });
  } catch (error) {
    console.error('Handle VNPay return error:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};
const createVnpayPayment = (req, res) => {
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

const verifyVnpaySignature = (vnpayData, secretKey) => {
  const secureHash = vnpayData.vnp_SecureHash;
  delete vnpayData.vnp_SecureHash;

  const sortedParams = Object.keys(vnpayData).sort().reduce((acc, key) => {
    acc[key] = vnpayData[key];
    return acc;
  }, {});
  const signData = Object.keys(sortedParams)
    .map(key => `${key}=${encodeURIComponent(sortedParams[key]).replace(/%20/g, '+')}`)
    .join('&');
  const hmac = crypto.createHmac('sha512', secretKey);
  const calculatedHash = hmac.update(signData).digest('hex');

  return secureHash === calculatedHash;
};

module.exports = {
  handleVnpayReturn,
  verifyVnpaySignature,
  createVnpayPayment
};