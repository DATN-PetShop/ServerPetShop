const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createOrder,
  getMyOrders,
  updateOrder,
  deleteOrder
} = require('../controllers/orderController');
const requireRole = require('../middleware/requireRole');

// User routes
router.get('/', auth, getMyOrders); // Get list of user's orders

// Admin routes
router.post('/', auth, requireRole(['Admin','Staff']), createOrder); // Create new order
router.put('/:id', auth, requireRole(['Admin', 'Staff']), updateOrder); // Update order
router.delete('/:id', auth, requireRole(['Admin']), deleteOrder); // Delete order

module.exports = router;