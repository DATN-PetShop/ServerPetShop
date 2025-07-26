// src/socket/notificationSocketHandler.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class NotificationSocketHandler {
    constructor(io) {
        this.io = io;
        this.activeUsers = new Map(); // userId -> socketId
        this.userSockets = new Map(); // socketId -> user info
        this.setupSocketEvents();
    }

    setupSocketEvents() {
        this.io.on('connection', (socket) => {
            console.log('🔔 User connected for notifications:', socket.id);

            // Authentication event for notifications
            socket.on('authenticate_notifications', async (data) => {
                await this.handleAuthentication(socket, data);
            });

            // Request user's unread notifications
            socket.on('get_unread_notifications', async () => {
                await this.handleGetUnreadNotifications(socket);
            });

            // Mark notification as read
            socket.on('mark_notification_read', async (data) => {
                await this.handleMarkNotificationRead(socket, data);
            });

            // Mark all notifications as read
            socket.on('mark_all_notifications_read', async () => {
                await this.handleMarkAllNotificationsRead(socket);
            });

            // Disconnect event
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    async handleAuthentication(socket, data) {
        try {
            const { token } = data;

            if (!token) {
                socket.emit('notification_auth_error', { message: 'Token is required' });
                return;
            }

            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Get user info
            const user = await User.findById(decoded.userId).select('-password_hash');
            if (!user) {
                socket.emit('notification_auth_error', { message: 'User not found' });
                return;
            }

            // Store user info in socket
            socket.userId = user._id.toString();
            socket.userRole = user.role;
            socket.username = user.username;

            // Store active user mapping
            this.activeUsers.set(socket.userId, socket.id);
            this.userSockets.set(socket.id, {
                userId: socket.userId,
                role: socket.userRole,
                username: socket.username
            });

            // Join user-specific notification room
            socket.join(`notifications_${socket.userId}`);

            socket.emit('notification_authenticated', { 
                success: true,
                user: {
                    id: socket.userId,
                    username: socket.username,
                    role: socket.userRole
                }
            });

            console.log(`✅ User authenticated for notifications: ${socket.username}`);

            // Send current unread count
            await this.sendUnreadCount(socket);

        } catch (error) {
            console.error('Notification authentication error:', error);
            socket.emit('notification_auth_error', { 
                message: error.name === 'JsonWebTokenError' ? 'Invalid token' : 'Authentication failed'
            });
        }
    }

    async handleGetUnreadNotifications(socket) {
        try {
            if (!socket.userId) {
                socket.emit('notification_error', { message: 'Not authenticated' });
                return;
            }

            const Notification = require('../models/Notification');
            const unreadNotifications = await Notification
                .find({ 
                    user_id: socket.userId, 
                    is_read: false 
                })
                .sort({ created_at: -1 })
                .limit(20)
                .lean();

            socket.emit('unread_notifications', {
                notifications: unreadNotifications,
                count: unreadNotifications.length
            });

        } catch (error) {
            console.error('Get unread notifications error:', error);
            socket.emit('notification_error', { message: 'Failed to get notifications' });
        }
    }

    async handleMarkNotificationRead(socket, data) {
        try {
            const { notificationId } = data;

            if (!socket.userId) {
                socket.emit('notification_error', { message: 'Not authenticated' });
                return;
            }

            if (!notificationId) {
                socket.emit('notification_error', { message: 'Notification ID is required' });
                return;
            }

            const Notification = require('../models/Notification');
            const updated = await Notification.findOneAndUpdate(
                { 
                    _id: notificationId, 
                    user_id: socket.userId 
                },
                { is_read: true },
                { new: true }
            );

            if (updated) {
                socket.emit('notification_marked_read', { 
                    notificationId: notificationId,
                    success: true 
                });

                // Send updated unread count
                await this.sendUnreadCount(socket);
            } else {
                socket.emit('notification_error', { message: 'Notification not found or access denied' });
            }

        } catch (error) {
            console.error('Mark notification read error:', error);
            socket.emit('notification_error', { message: 'Failed to mark notification as read' });
        }
    }

    async handleMarkAllNotificationsRead(socket) {
        try {
            if (!socket.userId) {
                socket.emit('notification_error', { message: 'Not authenticated' });
                return;
            }

            const Notification = require('../models/Notification');
            await Notification.updateMany(
                { 
                    user_id: socket.userId, 
                    is_read: false 
                },
                { is_read: true }
            );

            socket.emit('all_notifications_marked_read', { success: true });
            
            // Send updated unread count (should be 0)
            await this.sendUnreadCount(socket);

        } catch (error) {
            console.error('Mark all notifications read error:', error);
            socket.emit('notification_error', { message: 'Failed to mark all notifications as read' });
        }
    }

    async sendUnreadCount(socket) {
        try {
            if (!socket.userId) return;

            const Notification = require('../models/Notification');
            const unreadCount = await Notification.countDocuments({
                user_id: socket.userId,
                is_read: false
            });

            socket.emit('unread_notifications_count', { count: unreadCount });

        } catch (error) {
            console.error('Send unread count error:', error);
        }
    }

    handleDisconnect(socket) {
        const userInfo = this.userSockets.get(socket.id);
        
        if (userInfo) {
            // Remove from active users
            this.activeUsers.delete(userInfo.userId);
            this.userSockets.delete(socket.id);
            console.log(`🔔 User disconnected from notifications: ${userInfo.username}`);
        }
    }

    // Public methods for sending notifications to specific users
    async sendNotificationToUser(userId, notification) {
        try {
            const socketId = this.activeUsers.get(userId.toString());
            
            if (socketId) {
                // User is online - send real-time notification
                this.io.to(socketId).emit('new_notification', {
                    id: notification._id,
                    type: notification.type,
                    message: notification.message,
                    relatedEntityId: notification.related_entity_id,
                    relatedEntityType: notification.related_entity_type,
                    createdAt: notification.created_at,
                    isRead: notification.is_read
                });

                // Also send to user's notification room (in case of multiple devices)
                this.io.to(`notifications_${userId}`).emit('new_notification', {
                    id: notification._id,
                    type: notification.type,
                    message: notification.message,
                    relatedEntityId: notification.related_entity_id,
                    relatedEntityType: notification.related_entity_type,
                    createdAt: notification.created_at,
                    isRead: notification.is_read
                });

                // Update unread count
                const Notification = require('../models/Notification');
                const unreadCount = await Notification.countDocuments({
                    user_id: userId,
                    is_read: false
                });

                this.io.to(socketId).emit('unread_notifications_count', { count: unreadCount });

                console.log(`🔔 Real-time notification sent to user ${userId}: ${notification.type}`);
                return true;
            } else {
                console.log(`🔔 User ${userId} not online - notification stored for later`);
                return false;
            }
        } catch (error) {
            console.error('Send notification to user error:', error);
            return false;
        }
    }

    // Send broadcast notifications to all online users (for system announcements)
    async sendBroadcastNotification(notification, excludeUserId = null) {
        try {
            this.userSockets.forEach((userInfo, socketId) => {
                if (excludeUserId && userInfo.userId === excludeUserId.toString()) {
                    return; // Skip excluded user
                }

                this.io.to(socketId).emit('broadcast_notification', {
                    id: notification._id || Date.now(),
                    type: notification.type,
                    message: notification.message,
                    createdAt: notification.createdAt || new Date(),
                    priority: notification.priority || 'normal'
                });
            });

            console.log(`🔔 Broadcast notification sent to ${this.userSockets.size} online users`);
        } catch (error) {
            console.error('Send broadcast notification error:', error);
        }
    }

    // Check if user is online for notifications
    isUserOnlineForNotifications(userId) {
        return this.activeUsers.has(userId.toString());
    }

    // Get online users count
    getOnlineUsersCount() {
        return this.activeUsers.size;
    }
}

module.exports = NotificationSocketHandler;