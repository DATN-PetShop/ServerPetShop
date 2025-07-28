const { Expo } = require('expo-server-sdk');
const PushToken = require('../models/pushToken');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Tạo một instance của Expo SDK
const expo = new Expo();

// Lưu hoặc cập nhật push token
const savePushToken = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.id; // Lấy từ middleware auth

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Push token is required'
            });
        }

        // Kiểm tra xem token có hợp lệ không
        if (!Expo.isExpoPushToken(token)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Expo push token'
            });
        }

        // Xử lý token (có thể có nhiều user dùng cùng 1 token hoặc 1 user đổi token)
        try {
            // Xóa token cũ của user này (nếu có)
            await PushToken.deleteMany({ userId });
            
            // Xóa token này nếu đã tồn tại cho user khác (user đổi thiết bị)
            await PushToken.deleteMany({ token });
            
            // Tạo token mới
            await PushToken.create({
                token,
                userId
            });
            
        } catch (dbError) {
            // Nếu vẫn lỗi duplicate, thử dùng upsert
            await PushToken.findOneAndUpdate(
                { userId },
                { token, createdAt: new Date() },
                { upsert: true, new: true }
            );
        }

        res.status(200).json({
            success: true,
            message: 'Push token saved successfully'
        });

    } catch (error) {
        console.error('Error saving push token:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Xóa push token
const removePushToken = async (req, res) => {
    try {
        const userId = req.user.id;

        await PushToken.findOneAndDelete({ userId });

        res.status(200).json({
            success: true,
            message: 'Push token removed successfully'
        });

    } catch (error) {
        console.error('Error removing push token:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Gửi notification cho một user cụ thể
const sendNotificationToUser = async (userId, notificationData) => {
    try {
        const { title, body, data = {}, type, relatedEntityId, relatedEntityType } = notificationData;

        // Lưu notification vào database
        const notification = await Notification.create({
            type,
            message: body,
            related_entity_id: relatedEntityId || null, // Cho phép null
            related_entity_type: relatedEntityType || 'System', // Default là System
            user_id: userId
        });

        // Lấy push token của user
        const pushTokenRecord = await PushToken.findOne({ userId });
        
        if (!pushTokenRecord) {
            console.log(`No push token found for user ${userId}`);
            return { success: false, message: 'No push token found' };
        }

        const pushToken = pushTokenRecord.token;

        // Kiểm tra token có hợp lệ không
        if (!Expo.isExpoPushToken(pushToken)) {
            console.log(`Invalid push token for user ${userId}`);
            await PushToken.findOneAndDelete({ userId }); // Xóa token không hợp lệ
            return { success: false, message: 'Invalid push token' };
        }

        // Tạo message để gửi
        const message = {
            to: pushToken,
            sound: 'default',
            title,
            body,
            data: {
                ...data,
                notificationId: notification._id.toString(),
                type,
                relatedEntityId,
                relatedEntityType
            }
        };

        // Gửi notification
        const chunks = expo.chunkPushNotifications([message]);
        const tickets = [];

        for (let chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error('Error sending push notification chunk:', error);
            }
        }

        // Kiểm tra kết quả
        const receiptIds = [];
        for (let ticket of tickets) {
            if (ticket.id) {
                receiptIds.push(ticket.id);
            }
        }

        return {
            success: true,
            message: 'Notification sent successfully',
            notificationId: notification._id,
            receiptIds
        };

    } catch (error) {
        console.error('Error sending notification to user:', error);
        return { 
            success: false, 
            message: 'Failed to send notification',
            error: error.message 
        };
    }
};

// Gửi notification cho nhiều user (bulk send)
const sendNotificationToMultipleUsers = async (userIds, notificationData) => {
    try {
        const results = [];
        
        for (const userId of userIds) {
            const result = await sendNotificationToUser(userId, notificationData);
            results.push({
                userId,
                ...result
            });
        }

        return results;

    } catch (error) {
        console.error('Error sending notifications to multiple users:', error);
        return { 
            success: false, 
            message: 'Failed to send notifications',
            error: error.message 
        };
    }
};

// API endpoint để gửi notification cho tất cả users (dành cho admin)
const sendNotificationToAllUsers = async (req, res) => {
    try {
        const { title, body, type, relatedEntityId, relatedEntityType, data } = req.body;

        if (!title || !body || !type) {
            return res.status(400).json({
                success: false,
                message: 'Title, body, and type are required'
            });
        }

        // Lấy tất cả user IDs có push token
        const pushTokens = await PushToken.find().populate('userId', '_id username');
        const userIds = pushTokens.map(token => token.userId._id.toString());

        if (userIds.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No users with push tokens found'
            });
        }

        const notificationData = {
            title,
            body,
            type,
            relatedEntityId,
            relatedEntityType,
            data: data || {}
        };

        // Gửi notification cho tất cả users
        const results = await sendNotificationToMultipleUsers(userIds, notificationData);

        // Thống kê kết quả
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        res.status(200).json({
            success: true,
            message: `Notifications sent to all users`,
            data: {
                totalUsers: userIds.length,
                successCount,
                failCount,
                results
            }
        });

    } catch (error) {
        console.error('Error in send notification to all users API:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// API endpoint để gửi notification thủ công (dành cho admin)
const sendNotification = async (req, res) => {
    try {
        const { userIds, title, body, type, relatedEntityId, relatedEntityType, data } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'User IDs array is required'
            });
        }

        if (!title || !body || !type) {
            return res.status(400).json({
                success: false,
                message: 'Title, body, and type are required'
            });
        }

        const notificationData = {
            title,
            body,
            type,
            relatedEntityId,
            relatedEntityType,
            data: data || {}
        };

        let results;
        if (userIds.length === 1) {
            results = await sendNotificationToUser(userIds[0], notificationData);
        } else {
            results = await sendNotificationToMultipleUsers(userIds, notificationData);
        }

        res.status(200).json({
            success: true,
            message: 'Notifications processed',
            results
        });

    } catch (error) {
        console.error('Error in send notification API:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Lấy danh sách notification của user
const getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, isRead } = req.query;

        const query = { user_id: userId };
        if (isRead !== undefined) {
            query.is_read = isRead === 'true';
        }

        const notifications = await Notification.find(query)
            .sort({ created_at: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('user_id', 'username email');

        const total = await Notification.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                notifications,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Error getting user notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Đánh dấu notification đã đọc
const markNotificationAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;

        const notification = await Notification.findOne({
            _id: notificationId,
            user_id: userId
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        notification.is_read = true;
        await notification.save();

        res.status(200).json({
            success: true,
            message: 'Notification marked as read',
            data: notification
        });

    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Đánh dấu tất cả notification đã đọc
const markAllNotificationsAsRead = async (req, res) => {
    try {
        const userId = req.user.id;

        await Notification.updateMany(
            { user_id: userId, is_read: false },
            { is_read: true }
        );

        res.status(200).json({
            success: true,
            message: 'All notifications marked as read'
        });

    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Lấy số lượng notification chưa đọc
const getUnreadNotificationCount = async (req, res) => {
    try {
        const userId = req.user.id;

        const count = await Notification.countDocuments({
            user_id: userId,
            is_read: false
        });

        res.status(200).json({
            success: true,
            data: { unreadCount: count }
        });

    } catch (error) {
        console.error('Error getting unread notification count:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    savePushToken,
    removePushToken,
    sendNotificationToUser,
    sendNotificationToMultipleUsers,
    sendNotification,
    sendNotificationToAllUsers,
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadNotificationCount
};
