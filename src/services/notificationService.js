// src/services/notificationService.js
const Notification = require('../models/Notification');

class NotificationService {
    constructor(notificationSocketHandler = null) {
        this.socketHandler = notificationSocketHandler;
    }

    setSocketHandler(socketHandler) {
        this.socketHandler = socketHandler;
    }

    // Create and send a notification
    async createAndSendNotification({
        userId,
        type,
        message,
        relatedEntityId,
        relatedEntityType,
        priority = 'normal'
    }) {
        try {
            // Create notification in database
            const notification = await Notification.create({
                user_id: userId,
                type: type,
                message: message,
                related_entity_id: relatedEntityId,
                related_entity_type: relatedEntityType,
                is_read: false,
                created_at: new Date()
            });

            console.log(`📝 Notification created: ${type} for user ${userId}`);

            // Send real-time notification if socket handler is available
            if (this.socketHandler) {
                await this.socketHandler.sendNotificationToUser(userId, notification);
            }

            return notification;
        } catch (error) {
            console.error('Create and send notification error:', error);
            throw error;
        }
    }

    // Order-related notifications
    async notifyOrderCreated(userId, orderId) {
        return await this.createAndSendNotification({
            userId: userId,
            type: 'order_created',
            message: 'Đơn hàng của bạn đã được tạo thành công và đang được xử lý.',
            relatedEntityId: orderId,
            relatedEntityType: 'Order',
            priority: 'high'
        });
    }

    async notifyOrderConfirmed(userId, orderId) {
        return await this.createAndSendNotification({
            userId: userId,
            type: 'order_confirmed',
            message: 'Đơn hàng của bạn đã được xác nhận và đang được chuẩn bị.',
            relatedEntityId: orderId,
            relatedEntityType: 'Order',
            priority: 'high'
        });
    }

    async notifyOrderShipped(userId, orderId, trackingNumber = null) {
        const message = trackingNumber 
            ? `Đơn hàng của bạn đã được giao cho đơn vị vận chuyển. Mã vận đơn: ${trackingNumber}`
            : 'Đơn hàng của bạn đã được giao cho đơn vị vận chuyển.';

        return await this.createAndSendNotification({
            userId: userId,
            type: 'order_shipped',
            message: message,
            relatedEntityId: orderId,
            relatedEntityType: 'Order',
            priority: 'high'
        });
    }

    async notifyOrderDelivered(userId, orderId) {
        return await this.createAndSendNotification({
            userId: userId,
            type: 'order_delivered',
            message: 'Đơn hàng của bạn đã được giao thành công. Cảm ơn bạn đã mua sắm!',
            relatedEntityId: orderId,
            relatedEntityType: 'Order',
            priority: 'high'
        });
    }

    async notifyOrderCancelled(userId, orderId, reason = '') {
        const message = reason 
            ? `Đơn hàng của bạn đã bị hủy. Lý do: ${reason}`
            : 'Đơn hàng của bạn đã bị hủy.';

        return await this.createAndSendNotification({
            userId: userId,
            type: 'order_cancelled',
            message: message,
            relatedEntityId: orderId,
            relatedEntityType: 'Order',
            priority: 'high'
        });
    }

    // Payment-related notifications
    async notifyPaymentSuccessful(userId, paymentId, amount) {
        return await this.createAndSendNotification({
            userId: userId,
            type: 'payment_successful',
            message: `Thanh toán ${amount.toLocaleString('vi-VN')}₫ đã được xử lý thành công.`,
            relatedEntityId: paymentId,
            relatedEntityType: 'Payment',
            priority: 'high'
        });
    }

    async notifyPaymentFailed(userId, paymentId, reason = '') {
        const message = reason 
            ? `Thanh toán không thành công. Lý do: ${reason}`
            : 'Thanh toán không thành công. Vui lòng thử lại.';

        return await this.createAndSendNotification({
            userId: userId,
            type: 'payment_failed',
            message: message,
            relatedEntityId: paymentId,
            relatedEntityType: 'Payment',
            priority: 'high'
        });
    }

    async notifyRefundProcessed(userId, orderId, amount) {
        return await this.createAndSendNotification({
            userId: userId,
            type: 'refund_processed',
            message: `Hoàn tiền ${amount.toLocaleString('vi-VN')}₫ đã được xử lý và sẽ về tài khoản của bạn trong 3-5 ngày làm việc.`,
            relatedEntityId: orderId,
            relatedEntityType: 'Order',
            priority: 'high'
        });
    }

    // Appointment-related notifications
    async notifyAppointmentConfirmed(userId, appointmentId, appointmentDate) {
        return await this.createAndSendNotification({
            userId: userId,
            type: 'appointment_confirmed',
            message: `Lịch hẹn của bạn đã được xác nhận vào ${appointmentDate}.`,
            relatedEntityId: appointmentId,
            relatedEntityType: 'Appointment',
            priority: 'high'
        });
    }

    async notifyAppointmentReminder(userId, appointmentId, appointmentDate) {
        return await this.createAndSendNotification({
            userId: userId,
            type: 'appointment_reminder',
            message: `Nhắc nhở: Bạn có lịch hẹn vào ${appointmentDate}. Vui lòng đến đúng giờ.`,
            relatedEntityId: appointmentId,
            relatedEntityType: 'Appointment',
            priority: 'high'
        });
    }

    async notifyAppointmentCancelled(userId, appointmentId, reason = '') {
        const message = reason 
            ? `Lịch hẹn của bạn đã bị hủy. Lý do: ${reason}`
            : 'Lịch hẹn của bạn đã bị hủy.';

        return await this.createAndSendNotification({
            userId: userId,
            type: 'appointment_cancelled',
            message: message,
            relatedEntityId: appointmentId,
            relatedEntityType: 'Appointment',
            priority: 'high'
        });
    }

    // Product-related notifications
    async notifyProductBackInStock(userId, productId, productName) {
        return await this.createAndSendNotification({
            userId: userId,
            type: 'product_back_in_stock',
            message: `Sản phẩm "${productName}" đã có hàng trở lại. Đặt ngay để không bỏ lỡ!`,
            relatedEntityId: productId,
            relatedEntityType: 'Product'
        });
    }

    async notifyProductOnSale(userId, productId, productName, discountPercent) {
        return await this.createAndSendNotification({
            userId: userId,
            type: 'product_on_sale',
            message: `Sản phẩm "${productName}" đang giảm giá ${discountPercent}%! Mua ngay!`,
            relatedEntityId: productId,
            relatedEntityType: 'Product'
        });
    }

    // Voucher-related notifications
    async notifyVoucherReceived(userId, voucherId, voucherCode, discountValue) {
        return await this.createAndSendNotification({
            userId: userId,
            type: 'voucher_received',
            message: `Bạn đã nhận được mã giảm giá ${voucherCode} trị giá ${discountValue}. Sử dụng ngay!`,
            relatedEntityId: voucherId,
            relatedEntityType: 'Voucher'
        });
    }

    async notifyVoucherExpiringSoon(userId, voucherId, voucherCode, expiryDate) {
        return await this.createAndSendNotification({
            userId: userId,
            type: 'voucher_expiring',
            message: `Mã giảm giá ${voucherCode} sẽ hết hạn vào ${expiryDate}. Sử dụng ngay!`,
            relatedEntityId: voucherId,
            relatedEntityType: 'Voucher'
        });
    }

    // System notifications
    async notifySystemMaintenance(maintenanceTime, duration) {
        const message = `Hệ thống sẽ bảo trì từ ${maintenanceTime} trong ${duration}. Xin lỗi vì sự bất tiện.`;
        
        if (this.socketHandler) {
            await this.socketHandler.sendBroadcastNotification({
                type: 'system_maintenance',
                message: message,
                priority: 'high',
                createdAt: new Date()
            });
        }
    }

    async notifySystemUpdate(updateDetails) {
        const message = `Hệ thống đã được cập nhật với các tính năng mới: ${updateDetails}`;
        
        if (this.socketHandler) {
            await this.socketHandler.sendBroadcastNotification({
                type: 'system_update',
                message: message,
                priority: 'normal',
                createdAt: new Date()
            });
        }
    }

    // Welcome notification for new users
    async notifyWelcomeNewUser(userId, username) {
        return await this.createAndSendNotification({
            userId: userId,
            type: 'welcome',
            message: `Chào mừng ${username} đến với PetShop! Khám phá những sản phẩm tuyệt vời cho thú cưng của bạn.`,
            relatedEntityId: userId,
            relatedEntityType: 'User'
        });
    }

    // Chat message notification (when user is not online in chat)
    async notifyChatMessage(userId, messageContent, senderName) {
        return await this.createAndSendNotification({
            userId: userId,
            type: 'chat_message',
            message: `${senderName}: ${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}`,
            relatedEntityId: userId,
            relatedEntityType: 'ChatMessage'
        });
    }

    // Bulk notifications for multiple users
    async sendBulkNotifications(userIds, notificationData) {
        try {
            const promises = userIds.map(userId => 
                this.createAndSendNotification({
                    ...notificationData,
                    userId: userId
                })
            );

            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            console.log(`📧 Bulk notifications sent: ${successful} successful, ${failed} failed`);
            return { successful, failed };
        } catch (error) {
            console.error('Send bulk notifications error:', error);
            throw error;
        }
    }

    // Get user's notifications with pagination
    async getUserNotifications(userId, page = 1, limit = 20, unreadOnly = false) {
        try {
            const query = { user_id: userId };
            if (unreadOnly) {
                query.is_read = false;
            }

            const skip = (page - 1) * limit;
            
            const notifications = await Notification
                .find(query)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const totalCount = await Notification.countDocuments(query);
            const unreadCount = await Notification.countDocuments({
                user_id: userId,
                is_read: false
            });

            return {
                notifications,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalCount / limit),
                    totalCount,
                    limit
                },
                unreadCount
            };
        } catch (error) {
            console.error('Get user notifications error:', error);
            throw error;
        }
    }
}

module.exports = NotificationService;