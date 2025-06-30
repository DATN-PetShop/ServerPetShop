const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const {
  addAddress,
  getAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  clearAddresses,
  getAddressCount,
  getDefaultAddress
} = require('../controllers/addressController');

router.get('/', auth, getAddresses); // Lấy toàn bộ địa chỉ của user
router.get('/default', auth, getDefaultAddress); // Lấy địa chỉ mặc định
router.get('/count', auth, getAddressCount); // Đếm số lượng địa chỉ
router.get('/:id', auth, getAddressById); // Lấy địa chỉ theo ID
router.post('/', auth, addAddress); // Thêm địa chỉ mới
router.put('/:id', auth, updateAddress); // Cập nhật địa chỉ
router.delete('/:id', auth, deleteAddress); // Xóa địa chỉ
router.delete('/clear/all', auth, clearAddresses); // Xóa toàn bộ địa chỉ của user

module.exports = router;
