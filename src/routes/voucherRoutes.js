// src/routes/voucherRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const {
  createVoucher,
  getAllVouchers,
  updateVoucher,
  deleteVoucher,
  searchVouchers,
  saveVoucher
} = require('../controllers/voucherController');

router.get('/', getAllVouchers); // Tất cả vai trò có thể xem

router.get('/admin', auth, requireRoles(['Admin']), getAllVouchers); 

router.post('/', auth, requireRoles(['Admin', 'Staff']), createVoucher);
router.put('/:id', auth, updateVoucher);
router.delete('/:id', auth, requireRoles(['Admin']), deleteVoucher);

router.get('/search', searchVouchers);

router.post('/save/:voucherId', auth, saveVoucher); // Người dùng đã xác thực có thể lưu voucher

module.exports = router;