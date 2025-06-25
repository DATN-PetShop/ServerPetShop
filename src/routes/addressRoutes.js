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

router.get('/', auth, getAllAddresses); 
router.get('/:id', auth, getAddressById); 
router.post('/', auth,  createAddress);
router.put('/:id', auth, updateAddress);
router.delete('/:id', auth, deleteAddress);

module.exports = router;