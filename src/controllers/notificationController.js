const Notification = require('../models/Notification');
const BaseCrudController = require('./baseCrudController');
const NotificationService = require('../services/notificationService');

class NotificationController extends BaseCrudController {
  constructor() {
    super(Notification);
  }
  
  async create(req, res) {
    try {
      const newNotification = await this.model.create(req.body);
      
      // Send real-time notification using socket
      if (req.app && req.app.get('notificationSocketHandler')) {
        const socketHandler = req.app.get('notificationSocketHandler');
        await socketHandler.sendNotificationToUser(newNotification.user_id, newNotification);
      }

      // 3. Trả về response thành công
      res.status(201).json({
        success: true,
        statusCode: 201,
        message: `${this.getEntityName()} created successfully`,
        data: newNotification
      });
    } catch (error) {
      console.error(`Create ${this.getEntityName()} error:`, error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  getRequiredFields() {
    return ['type', 'message', 'related_entity_id', 'related_entity_type', 'user_id'];
  }

  getEntityName() {
    return 'Notification';
  }

  async getAllNotifications(req, res) {
    try {
      let notifications;
      if (req.user && req.user.id) {
        // Regular users can only see their own notifications
        if (req.user.role === 'Admin' || req.user.role === 'Staff') {
          // Admin/Staff can see all notifications
          notifications = await this.model.find().populate('user_id', 'username email').sort({ created_at: -1 }).lean();
        } else {
          // Regular users see only their notifications
          notifications = await this.model.find({ user_id: req.user.id }).sort({ created_at: -1 }).lean();
        }
      } else {
        return res.status(401).json({
          success: false,
          statusCode: 401,
          message: 'Authentication required',
          data: null
        });
      }

      if (!notifications || notifications.length === 0) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'No notifications found',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'All notifications retrieved successfully',
        data: notifications
      });
    } catch (error) {
      console.error('Get all notifications error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Get user's notifications with pagination
  async getUserNotifications(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          statusCode: 401,
          message: 'Authentication required',
          data: null
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const unreadOnly = req.query.unread_only === 'true';

      const notificationService = new NotificationService();
      const result = await notificationService.getUserNotifications(
        req.user.id, 
        page, 
        limit, 
        unreadOnly
      );

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'User notifications retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Get user notifications error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Mark specific notification as read
  async markNotificationAsRead(req, res) {
    try {
      const { id } = req.params;

      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          statusCode: 401,
          message: 'Authentication required',
          data: null
        });
      }

      const notification = await this.model.findOneAndUpdate(
        { 
          _id: id, 
          user_id: req.user.id 
        },
        { is_read: true },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Notification not found or access denied',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Notification marked as read',
        data: notification
      });
    } catch (error) {
      console.error('Mark notification as read error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Mark all user's notifications as read
  async markAllNotificationsAsRead(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          statusCode: 401,
          message: 'Authentication required',
          data: null
        });
      }

      const result = await this.model.updateMany(
        { 
          user_id: req.user.id, 
          is_read: false 
        },
        { is_read: true }
      );

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `${result.modifiedCount} notifications marked as read`,
        data: { modifiedCount: result.modifiedCount }
      });
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Get unread notifications count
  async getUnreadCount(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          statusCode: 401,
          message: 'Authentication required',
          data: null
        });
      }

      const unreadCount = await this.model.countDocuments({
        user_id: req.user.id,
        is_read: false
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Unread count retrieved successfully',
        data: { unreadCount }
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
}

const notificationController = new NotificationController();

module.exports = {
  createNotification: notificationController.create.bind(notificationController),
  getAllNotifications: notificationController.getAllNotifications.bind(notificationController),
  updateNotification: notificationController.update.bind(notificationController),
  deleteNotification: notificationController.delete.bind(notificationController),
  getUserNotifications: notificationController.getUserNotifications.bind(notificationController),
  markNotificationAsRead: notificationController.markNotificationAsRead.bind(notificationController),
  markAllNotificationsAsRead: notificationController.markAllNotificationsAsRead.bind(notificationController),
  getUnreadCount: notificationController.getUnreadCount.bind(notificationController)
};