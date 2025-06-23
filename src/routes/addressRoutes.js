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
  getAddressCount
} = require('../controllers/addressController');

router.post('/', auth, addAddress);
router.get('/', auth, getAddresses);
router.get('/count/total', auth, getAddressCount);
router.get('/:id', auth, getAddressById);
router.put('/:id', auth, updateAddress);
router.delete('/:id', auth, deleteAddress);
router.delete('/', auth, clearAddresses);

module.exports = router;