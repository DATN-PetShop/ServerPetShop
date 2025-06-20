const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  addAddress,
  getAddresses,
  updateAddress,
  deleteAddress,
  clearAddresses,
  getAddressCount
} = require('../controllers/addressController');

//Thêm địa chỉ mới
router.post('/', auth, addAddress);

//Lấy danh sách địa chỉ của user
router.get('/', auth, getAddresses);

//Cập nhật địa chỉ theo ID
router.put('/:id', auth, updateAddress);

//Xoá một địa chỉ theo ID
router.delete('/:id', auth, deleteAddress);

//Xoá toàn bộ địa chỉ của user
router.delete('/', auth, clearAddresses);

//Lấy tổng số lượng địa chỉ của user
router.get('/count/total', auth, getAddressCount);

module.exports = router;
