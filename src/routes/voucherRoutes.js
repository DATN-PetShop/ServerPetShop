const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const {
  createVoucher,
  getAllVouchers,
  updateVoucher,
  deleteVoucher,
  searchVouchers
} = require('../controllers/voucherController');

router.get('/', getAllVouchers); // all roles can view

router.get('/admin', auth, requireRoles(['Admin']), getAllVouchers); 

router.post('/', auth, requireRoles(['Admin', 'Staff']), createVoucher);
router.put('/:id', auth, requireRoles(['Admin', 'Staff']), updateVoucher);
router.delete('/:id', auth, requireRoles(['Admin']), deleteVoucher);

router.get('/search', searchVouchers);

module.exports = router;