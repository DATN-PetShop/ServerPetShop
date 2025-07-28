const express = require('express');
const router = express.Router();
const {
    savePushToken,
    removePushToken,
    sendNotification,
    sendNotificationToAllUsers,
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadNotificationCount
} = require('../controllers/pushTokenController');

const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

// Routes cho push token
router.post('/token', auth, savePushToken);
router.delete('/token', auth, removePushToken);

// Routes cho notification
router.post('/send', auth, requireRole(['Admin', 'Staff']), sendNotification); // Gửi cho user cụ thể
router.post('/send-all', auth, requireRole(['Admin']), sendNotificationToAllUsers); // Gửi cho tất cả users
router.get('/notifications', auth, getUserNotifications);
router.put('/notifications/:notificationId/read', auth, markNotificationAsRead);
router.put('/notifications/read-all', auth, markAllNotificationsAsRead);
router.get('/notifications/unread-count', auth, getUnreadNotificationCount);

module.exports = router;
