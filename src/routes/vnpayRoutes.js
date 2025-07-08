const express = require('express');
const router = express.Router();
const {
    createVnpayPayment,
    handleVnpayReturn,
    verifyVnpaySignature
  } =  require('../controllers/vnpayController');
router.post('/create-vnpay-payment', createVnpayPayment); // Create VNPAY payment
router.get('/return', handleVnpayReturn);
router.post('/verify-signature', verifyVnpaySignature); // Verify VNPAY signature
module.exports = router; 