require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const userRoutes = require('./src/routes/userRoutes');
const app = express();

const crypto = require('crypto');
// Cấu hình CORS
app.use(cors());
app.use(express.json());

console.log('MONGODB_URI:', process.env.MONGODB_URI);

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.send('PetShop Server is running');
});

// thanh toán VNPay
app.post('/create-vnpay-payment', (req, res) => {
  console.log('Received POST request:', req.body); // Log yêu cầu nhận được
  const vnpUrl = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  const secretKey = 'N4TNAZDJNSTUBR497MKXZH6KCQS3D9B2';
  const vnpParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: 'VP0I8AWK',
    vnp_Amount: req.body.amount * 100,
    vnp_CurrCode: 'VND',
    vnp_TxnRef: 'order_' + Date.now(),
    vnp_OrderInfo: 'Thanh toan don hang',
    vnp_OrderType: '250000',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: 'datnshopgiaypickup://payment-result',
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
  console.log('Generated paymentUrl:', paymentUrl); // Log URL được tạo
  res.json({ paymentUrl });
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Lắng nghe tất cả các địa chỉ IP
app.listen(5000, '0.0.0.0', () => {
  console.log('Server running on port 5000');
  console.log('Access via:');
  console.log('- Local: http://localhost:5000');
  console.log('- Network: http://10.0.2.2:5000 (Android Emulator)');
});