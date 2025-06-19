const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const {
  createPayment,
  getAllPayments,
  updatePayment,
  deletePayment
} = require('../controllers/paymentController');

router.get('/', auth, requireRoles(['Admin','User']), getAllPayments);
router.post('/', auth, requireRoles(['Admin', 'User']), createPayment);
router.put('/:id', auth, requireRoles(['Admin', 'User']), updatePayment);
router.delete('/:id', auth, requireRoles(['Admin','User']), deletePayment);

module.exports = router;