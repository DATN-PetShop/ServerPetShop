const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const {
  createNotification,
  getAllNotifications,
  updateNotification,
  deleteNotification
} = require('../controllers/notificationController');

router.post('/', auth, createNotification);
router.get('/', auth, getAllNotifications);
router.put('/:id', auth, updateNotification);
router.delete('/:id', auth, deleteNotification);

module.exports = router;