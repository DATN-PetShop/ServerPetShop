const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const {
  createNotification,
  getAllNotifications,
  updateNotification,
  deleteNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount
} = require('../controllers/notificationController');

// Admin routes
router.post('/', auth, requireRoles(['Admin'], createNotification));
router.delete('/:id', auth, requireRoles(['Admin'], deleteNotification));

// User routes (customers can access their own notifications)
router.get('/', auth, getAllNotifications);
router.get('/user/my-notifications', auth, getUserNotifications);
router.get('/user/unread-count', auth, getUnreadCount);
router.put('/:id', auth, updateNotification);
router.put('/:id/read', auth, markNotificationAsRead);
router.put('/user/mark-all-read', auth, markAllNotificationsAsRead);

module.exports = router;