const express = require('express');
const router = express.Router();
const vnpayController = require('../controllers/vnpayController');

router.post('/create-vnpay-payment', vnpayController.createVnpayPayment);

module.exports = router; 