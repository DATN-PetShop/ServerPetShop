// src/controllers/chatController.js
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');

class ChatController {
  // 1. Bắt đầu chat cho customer
  async startChat(req, res) {
    try {
      const customer_id = req.user.userId;
      const userRole = req.userData.role;

      // Chỉ customer mới có thể bắt đầu chat
      if (userRole !== 'User') {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'Only customers can start chat',
          data: null
        });
      }

      // Tìm hoặc tạo room cho customer
      const room = await ChatRoom.findOrCreateRoom(customer_id);

      // Populate customer info
      await room.populate('customer_id', 'username email avatar_url');

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Chat started successfully',
        data: room
      });

    } catch (error) {
      console.error('Start chat error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // 2. Lấy lịch sử chat
  async getChatHistory(req, res) {
    try {
      const { roomId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user.userId;
      const userRole = req.userData.role;

      // Kiểm tra room có tồn tại không
      const room = await ChatRoom.findById(roomId);
      if (!room) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Chat room not found',
          data: null
        });
      }

      // Kiểm tra quyền truy cập đơn giản
      const hasAccess = room.hasAccess(userId, userRole);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'Access denied to this chat room',
          data: null
        });
      }

      // Lấy messages với pagination
      const messages = await ChatMessage.getChatHistory(roomId, page, limit);

      // Đếm tổng số messages
      const totalCount = await ChatMessage.countDocuments({ room_id: roomId });

      // Populate room info
      await room.populate('customer_id', 'username email avatar_url');

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Chat history retrieved successfully',
        data: {
          room: room,
          messages: messages,
          pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(totalCount / Number(limit)),
            totalCount,
            hasNextPage: Number(page) < Math.ceil(totalCount / Number(limit)),
            hasPrevPage: Number(page) > 1,
            limit: Number(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get chat history error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // 3. Lấy danh sách rooms cho staff
  async getRooms(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const userRole = req.userData.role;

      // Chỉ staff/admin mới xem được danh sách rooms
      if (!['Staff', 'Admin'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'Access denied. Staff or Admin role required.',
          data: null
        });
      }

      // Lấy rooms với pagination
      const rooms = await ChatRoom.getRoomsForStaff(page, limit);

      // Đếm tổng số rooms
      const totalCount = await ChatRoom.countDocuments({ status: 'open' });

      // Lấy tin nhắn cuối cùng cho mỗi room
      const roomsWithLastMessage = await Promise.all(
        rooms.map(async (room) => {
          const lastMessage = await ChatMessage.getLastMessageInRoom(room._id);
          return {
            ...room.toObject(),
            last_message: lastMessage
          };
        })
      );

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Rooms retrieved successfully',
        data: {
          rooms: roomsWithLastMessage,
          pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(totalCount / Number(limit)),
            totalCount,
            hasNextPage: Number(page) < Math.ceil(totalCount / Number(limit)),
            hasPrevPage: Number(page) > 1,
            limit: Number(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get rooms error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Helper method để tạo tin nhắn (cho Socket.IO sử dụng)
  async createMessage(roomId, senderId, content, messageType = 'text', imageUrl = null, senderRole) {
    try {
      const room = await ChatRoom.findById(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      let message;
      
      if (messageType === 'image' && imageUrl) {
        message = ChatMessage.createImageMessage(roomId, senderId, imageUrl, content, senderRole);
      } else {
        message = ChatMessage.createTextMessage(roomId, senderId, content, senderRole);
      }

      const savedMessage = await message.save();

      // Cập nhật room's updated_at
      room.updated_at = new Date();
      await room.save();

      // Populate sender info
      await savedMessage.populate('sender_id', 'username avatar_url role');

      return savedMessage;

    } catch (error) {
      console.error('Create message error:', error);
      throw error;
    }
  }

  // 4. Upload ảnh cho chat
  async uploadImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'No image file provided',
          data: null
        });
      }

      // Cloudinary tự động upload và trả về URL
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Image uploaded successfully',
        data: {
          imageUrl: req.file.path,
          originalName: req.file.originalname,
          size: req.file.size,
          uploadedBy: req.user.userId
        }
      });

    } catch (error) {
      console.error('Upload image error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Failed to upload image',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // 🔔 Helper method để gửi chat notification
  async sendChatNotification(roomId, messageContent, senderInfo) {
    try {
      const { sendNotificationToUser } = require('./pushTokenController');
      const room = await ChatRoom.findById(roomId).populate('customer_id', '_id username');
      
      if (!room) {
        return { success: false, message: 'Room not found' };
      }

      const customerId = room.customer_id._id.toString();
      const senderId = senderInfo.id;
      
      // Nếu staff gửi cho customer
      if (senderInfo.role !== 'User') {
        const result = await sendNotificationToUser(customerId, {
          title: '💬 Tin nhắn từ hỗ trợ',
          body: `${senderInfo.username}: ${messageContent}`,
          type: 'chat_message',
          relatedEntityId: roomId,
          relatedEntityType: 'ChatRoom',
          data: {
            roomId: roomId,
            staffId: senderId,
            staffName: senderInfo.username
          }
        });
        
        return result;
      }
      
      return { success: false, message: 'No notification needed' };
      
    } catch (error) {
      console.error('Send chat notification error:', error);
      return { success: false, message: error.message };
    }
  }
}

// Export controller instance
const chatController = new ChatController();

module.exports = {
  startChat: chatController.startChat.bind(chatController),
  getChatHistory: chatController.getChatHistory.bind(chatController),
  getRooms: chatController.getRooms.bind(chatController),
  uploadImage: chatController.uploadImage.bind(chatController),
  
  // Internal methods
  createMessage: chatController.createMessage.bind(chatController),
  sendChatNotification: chatController.sendChatNotification.bind(chatController)
};