const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const {
  createAddress,
  getAllAddresses,
  getAddressById,
  updateAddress,
  deleteAddress
} = require('../controllers/addressController');

router.get('/', auth, getAllAddresses); // Chỉ người dùng đã đăng nhập mới xem được
router.get('/:id', auth, getAddressById); // Xem chi tiết một bản ghi
router.post('/', auth, requireRoles(['Admin', 'User']), createAddress);
router.put('/:id', auth, requireRoles(['Admin', 'User']), updateAddress);
router.delete('/:id', auth, requireRoles(['Admin','User']), deleteAddress);

module.exports = router;