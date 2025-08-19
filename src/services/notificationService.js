const { sendNotificationToUser, sendNotificationToMultipleUsers, sendNotificationToAllUsers } = require('../controllers/pushTokenController');
const PushToken = require('../models/pushToken');
const User = require('../models/User');


// Notification khi có đơn hàng mới
const sendOrderNotification = async (userId, orderId, orderStatus) => {
    const notificationData = {
        title: 'Cập nhật đơn hàng',
        body: `Đơn hàng #${orderId} đã được ${orderStatus === 'confirmed' ? 'xác nhận' : 'cập nhật'}`,
        type: 'order',
        relatedEntityId: orderId,
        relatedEntityType: 'Order',
        data: {
            orderId,
            orderStatus
        }
    };

    return await sendNotificationToUser(userId, notificationData);
};

// Notification khi có lịch hẹn mới
const sendAppointmentNotification = async (userId, appointmentId, appointmentStatus) => {
    let message;
    switch (appointmentStatus) {
        case 'confirmed':
            message = 'Lịch hẹn của bạn đã được xác nhận';
            break;
        case 'cancelled':
            message = 'Lịch hẹn của bạn đã bị hủy';
            break;
        case 'completed':
            message = 'Lịch hẹn của bạn đã hoàn thành';
            break;
        default:
            message = 'Có cập nhật mới về lịch hẹn của bạn';
    }

    const notificationData = {
        title: 'Cập nhật lịch hẹn',
        body: message,
        type: 'appointment',
        relatedEntityId: appointmentId,
        relatedEntityType: 'Appointment',
        data: {
            appointmentId,
            appointmentStatus
        }
    };

    return await sendNotificationToUser(userId, notificationData);
};

// Notification khi có tin nhắn mới
const sendChatNotification = async (userId, senderId, senderName, messageContent) => {
    const notificationData = {
        title: `Tin nhắn mới từ ${senderName}`,
        body: messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent,
        type: 'chat',
        relatedEntityId: senderId,
        relatedEntityType: 'ChatMessage',
        data: {
            senderId,
            senderName
        }
    };

    return await sendNotificationToUser(userId, notificationData);
};

// Notification khi có khuyến mãi mới
const sendPromotionNotification = async (userIds, voucherId, voucherTitle) => {
    const notificationData = {
        title: 'Khuyến mãi mới!',
        body: `${voucherTitle} - Đừng bỏ lỡ cơ hội tuyệt vời này!`,
        type: 'promotion',
        relatedEntityId: voucherId,
        relatedEntityType: 'Voucher',
        data: {
            voucherId
        }
    };

    return await sendNotificationToMultipleUsers(userIds, notificationData);
};

// Notification nhắc nhở lịch hẹn
const sendAppointmentReminder = async (userId, appointmentId, appointmentDate) => {
    const notificationData = {
        title: 'Nhắc nhở lịch hẹn',
        body: `Bạn có lịch hẹn vào ngày ${appointmentDate}. Đừng quên nhé!`,
        type: 'reminder',
        relatedEntityId: appointmentId,
        relatedEntityType: 'Appointment',
        data: {
            appointmentId,
            appointmentDate
        }
    };

    return await sendNotificationToUser(userId, notificationData);
};

// Notification khi có review mới cho sản phẩm
const sendReviewNotification = async (sellerId, productId, productName, reviewRating) => {
    const notificationData = {
        title: 'Đánh giá mới',
        body: `Sản phẩm "${productName}" vừa nhận được đánh giá ${reviewRating} sao`,
        type: 'review',
        relatedEntityId: productId,
        relatedEntityType: 'Product',
        data: {
            productId,
            reviewRating
        }
    };

    return await sendNotificationToUser(sellerId, notificationData);
};

// Notification chào mừng user mới
const sendWelcomeNotification = async (userId, userName) => {
    const notificationData = {
        title: 'Chào mừng bạn đến với PetShop!',
        body: `Xin chào ${userName}! Cảm ơn bạn đã tham gia cộng đồng yêu thú cưng của chúng tôi.`,
        type: 'welcome',
        relatedEntityId: userId,
        relatedEntityType: 'User',
        data: {
            isWelcome: true
        }
    };

    return await sendNotificationToUser(userId, notificationData);
};

// Notification khi sản phẩm yêu thích có giảm giá
const sendFavoriteProductSaleNotification = async (userId, productId, productName, discountPercent) => {
    const notificationData = {
        title: 'Sản phẩm yêu thích đang giảm giá!',
        body: `"${productName}" đang giảm ${discountPercent}%. Nhanh tay mua ngay!`,
        type: 'sale',
        relatedEntityId: productId,
        relatedEntityType: 'Product',
        data: {
            productId,
            discountPercent
        }
    };

    return await sendNotificationToUser(userId, notificationData);
};

// Gửi announcement cho tất cả users
const sendAnnouncementToAll = async (title, body, data = {}) => {
    // Lấy tất cả user IDs có push token
    const pushTokens = await PushToken.find().populate('userId', '_id');
    const userIds = pushTokens.map(token => token.userId._id.toString());

    if (userIds.length === 0) {
        return { success: false, message: 'No users with push tokens found' };
    }

    const notificationData = {
        title,
        body,
        type: 'announcement',
        relatedEntityId: null,
        relatedEntityType: 'System',
        data
    };

    return await sendNotificationToMultipleUsers(userIds, notificationData);
};

// Gửi thông báo bảo trì hệ thống
const sendSystemMaintenanceNotification = async (maintenanceTime, estimatedDuration) => {
    return await sendAnnouncementToAll(
        '🔧 Thông báo bảo trì hệ thống',
        `Hệ thống sẽ bảo trì vào ${maintenanceTime}. Thời gian dự kiến: ${estimatedDuration}. Xin lỗi vì sự bất tiện này!`,
        {
            maintenanceTime,
            estimatedDuration,
            type: 'maintenance'
        }
    );
};

// Gửi thông báo cập nhật ứng dụng
const sendAppUpdateNotification = async (version, features) => {
    return await sendAnnouncementToAll(
        '🎉 Cập nhật ứng dụng mới!',
        `Phiên bản ${version} đã có sẵn với nhiều tính năng mới. Cập nhật ngay để trải nghiệm!`,
        {
            version,
            features,
            type: 'app_update'
        }
    );
};

module.exports = {
    sendOrderNotification,
    sendAppointmentNotification,
    sendChatNotification,
    sendPromotionNotification,
    sendAppointmentReminder,
    sendReviewNotification,
    sendWelcomeNotification,
    sendFavoriteProductSaleNotification,
    sendAnnouncementToAll,
    sendSystemMaintenanceNotification,
    sendAppUpdateNotification
};

// ================================
// Admin/Staff broadcast helpers
// ================================

/**
 * Notify all Admin/Staff users who have registered push tokens.
 * Falls back gracefully if no recipients are found.
 */
async function notifyAdmins(notificationData) {
    const adminsAndStaff = await User.find(
        { role: { $in: ['Admin', 'Staff'] }, status: 'active' },
        { _id: 1 }
    ).lean();

    const allAdminUserIds = adminsAndStaff.map(u => u._id.toString());

    if (allAdminUserIds.length === 0) {
        return { success: false, message: 'No Admin/Staff users found' };
    }

    return await sendNotificationToMultipleUsers(allAdminUserIds, notificationData);
}

module.exports.notifyAdmins = notifyAdmins;
