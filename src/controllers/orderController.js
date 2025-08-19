const Order = require('../models/Order');
const { sendOrderNotification } = require('../services/notificationService');

class OrderController {
  // Tạo đơn hàng mới
  async createOrder(req, res) {
    try {
      const { total_amount, status, payment_method, vnpay_transaction_id, payment_date } = req.body;

      if (!total_amount || !status || !payment_method) {
        return res.status(400).json({ 
          success: false,
          message: 'Thiếu các trường bắt buộc: total_amount, status, hoặc payment_method' 
        });
      }

      const order = new Order({
        total_amount,
        status,
        payment_method,
        vnpay_transaction_id: vnpay_transaction_id || null,
        payment_date: payment_date || null,
        user_id: req.user.userId
      });

      const savedOrder = await order.save();

      // Gửi notification cho user khi tạo đơn hàng thành công
      try {
        await sendOrderNotification(req.user.userId, savedOrder._id, 'created');
      } catch (notificationError) {
        console.error('Failed to send order notification:', notificationError);
      }

      // Gửi thông báo cho Admin/Staff về đơn hàng mới
      try {
        const { notifyAdmins } = require('../services/notificationService');
        await notifyAdmins({
          title: '🛒 Đơn hàng mới',
          body: `Khách hàng vừa tạo đơn #${savedOrder._id}`,
          type: 'order_admin',
          relatedEntityId: savedOrder._id,
          relatedEntityType: 'Order',
          data: { orderId: savedOrder._id }
        });
      } catch (adminNotifyErr) {
        console.error('Failed to notify admins about new order:', adminNotifyErr);
      }

      res.status(201).json({ 
        success: true,
        message: 'Tạo đơn hàng thành công',
        data: savedOrder 
      });
    } catch (error) {
      console.error('Create order error:', error.message);
      res.status(500).json({ 
        success: false,
        message: 'Lỗi server',
        error: error.message 
      });
    }
  }

  // Lấy danh sách đơn hàng của user
  async getMyOrders(req, res) {
    try {
      const orders = await Order.find({ user_id: req.user.userId })
        .populate('user_id', 'name email')
        .lean();

      res.status(200).json({ 
        success: true,
        message: 'Lấy danh sách đơn hàng thành công',
        data: orders 
      });
    } catch (error) {
      console.error('Fetch orders error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Lỗi server',
        error: error.message 
      });
    }
  }

  // Lấy đơn hàng theo ID
  async getOrderById(req, res) {
    try {
      const order = await Order.findOne({ 
        _id: req.params.id, 
        user_id: req.user.userId 
      })
        .populate('user_id', 'username email')
        .lean();

      if (!order) {
        return res.status(404).json({ 
          success: false,
          message: 'Không tìm thấy đơn hàng' 
        });
      }

      res.status(200).json({ 
        success: true,
        message: 'Lấy chi tiết đơn hàng thành công',
        data: order 
      });
    } catch (error) {
      console.error('Fetch order error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Lỗi server',
        error: error.message 
      });
    }
  }

  // Cập nhật đơn hàng
  async updateOrder(req, res) {
    try {
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: req.params.id, user_id: req.user.userId },
        req.body,
        { new: true }
      );

      if (!updatedOrder) {
        return res.status(404).json({ 
          success: false,
          message: 'Không tìm thấy đơn hàng' 
        });
      }

      res.status(200).json({ 
        success: true,
        message: 'Cập nhật đơn hàng thành công',
        data: updatedOrder 
      });
    } catch (error) {
      console.error('Update order error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Lỗi server',
        error: error.message 
      });
    }
  }

  // Xóa đơn hàng
  async deleteOrder(req, res) {
    try {
      const deletedOrder = await Order.findOneAndDelete({
        _id: req.params.id,
        user_id: req.user.userId
      });

      if (!deletedOrder) {
        return res.status(404).json({ 
          success: false,
          message: 'Không tìm thấy đơn hàng' 
        });
      }

      res.status(200).json({ 
        success: true,
        message: 'Xóa đơn hàng thành công' 
      });
    } catch (error) {
      console.error('Delete order error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Lỗi server',
        error: error.message 
      });
    }
  }

  // Lưu đơn hàng VNPay
  async saveVnpayOrder(req, res) {
    try {
      const { vnp_Amount, vnp_TxnRef, vnp_PayDate, vnp_ResponseCode, vnp_TransactionStatus, user_id } = req.body;

      if (vnp_ResponseCode !== '00' || vnp_TransactionStatus !== '00') {
        return res.status(400).json({ 
          success: false,
          message: 'Trạng thái thanh toán không hợp lệ' 
        });
      }

      const order = new Order({
        total_amount: vnp_Amount / 100, // Chia 100 để chuyển về VND
        status: 'completed',
        user_id,
        vnpay_transaction_id: vnp_TxnRef,
        payment_date: vnp_PayDate,
      });

      const savedOrder = await order.save();
      res.status(201).json({ 
        success: true,
        message: 'Tạo đơn hàng VNPay thành công',
        data: savedOrder 
      });
    } catch (error) {
      console.error('Save VNPay order error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Lỗi server',
        error: error.message 
      });
    }
  }

  // THÊM MỚI: Hủy đơn hàng
  async cancelOrder(req, res) {
    try {
      const user_id = req.user?.userId;
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Không xác thực được người dùng'
        });
      }

      const { id } = req.params;

      const order = await Order.findOne({ _id: id, user_id });
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy đơn hàng'
        });
      }

      // Chỉ cho phép hủy khi status là pending hoặc processing
      if (!['pending', 'processing'].includes(order.status)) {
        return res.status(400).json({
          success: false,
          message: 'Không thể hủy đơn hàng đã hoàn thành hoặc đã bị hủy'
        });
      }

      order.status = 'cancelled';
      await order.save();

      // Gửi notification khi hủy đơn hàng
      try {
        await sendOrderNotification(user_id, order._id, 'cancelled');
      } catch (notificationError) {
        console.error('Failed to send cancel order notification:', notificationError);
        // Không làm fail request chính nếu notification lỗi
      }

      res.status(200).json({
        success: true,
        message: 'Hủy đơn hàng thành công',
        data: order
      });
    } catch (error) {
      console.error('Cancel order error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }
}

const orderController = new OrderController();

module.exports = {
  createOrder: orderController.createOrder.bind(orderController),
  getMyOrders: orderController.getMyOrders.bind(orderController),
  getOrderById: orderController.getOrderById.bind(orderController),
  updateOrder: orderController.updateOrder.bind(orderController),
  deleteOrder: orderController.deleteOrder.bind(orderController),
  saveVnpayOrder: orderController.saveVnpayOrder.bind(orderController),
  cancelOrder: orderController.cancelOrder.bind(orderController)
};