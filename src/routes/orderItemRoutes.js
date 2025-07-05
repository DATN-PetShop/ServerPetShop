const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createOrderItem,
  getMyOrderItems,
  updateOrderItem,
  deleteOrderItem
} = require('../controllers/orderItemsController');
const requireRole = require('../middleware/requireRole');

router.get('/', auth, getMyOrderItems);

router.post('/', auth, requireRole(['Admin', 'Staff']), createOrderItem);
router.put('/:id', auth, requireRole(['Admin', 'Staff']), updateOrderItem);
router.delete('/:id', auth, requireRole(['Admin']), deleteOrderItem);

module.exports = router;