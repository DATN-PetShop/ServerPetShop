const Notification = require('../models/Notification');
const BaseCrudController = require('./baseCrudController');

class NotificationController extends BaseCrudController {
  constructor() {
    super(Notification);
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
        notifications = await this.model.find({ user_id: req.user.id }).lean();
      } else {
        // Nếu không có req.user.id, lấy tất cả thông báo (dành cho admin hoặc debug)
        notifications = await this.model.find().lean();
        console.log('No user ID found, fetching all notifications');
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
}

const notificationController = new NotificationController();

module.exports = {
  createNotification: notificationController.create.bind(notificationController),
  getAllNotifications: notificationController.getAllNotifications.bind(notificationController),
  updateNotification: notificationController.update.bind(notificationController),
  deleteNotification: notificationController.delete.bind(notificationController)
};