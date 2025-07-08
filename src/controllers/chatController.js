// src/controllers/chatController.js
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const BaseCrudController = require('./baseCrudController');

class ChatController extends BaseCrudController {
  constructor() {
    super(ChatRoom); // ChatRoom làm model chính
  }

  getRequiredFields() {
    return ['customer_id']; // Chỉ cần customer_id, các field khác có default
  }

  getEntityName() {
    return 'ChatRoom';
  }

  // Override create để xử lý logic đặc biệt cho chat room
  async createChatRoom(req, res) {
    try {
      const { subject, priority = 'medium' } = req.body;
      const customer_id = req.user.userId; // Từ auth middleware
      const userRole = req.userData.role; // Từ auth middleware

      // Chỉ User (customer) mới có thể tạo room
      if (userRole !== 'User') {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'Only customers can create chat rooms',
          data: null
        });
      }

      // Kiểm tra xem customer đã có room active chưa
      const existingRoom = await ChatRoom.findActiveRoomByCustomer(customer_id);
      
      if (existingRoom) {
        // Trả về room hiện có thay vì tạo mới
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: 'Active chat room found',
          data: existingRoom
        });
      }

      // Tạo room mới
      const newRoom = new ChatRoom({
        customer_id: customer_id,
        subject: subject || 'Customer Support',
        priority: priority,
        status: 'waiting'
      });

      const savedRoom = await newRoom.save();

      // Populate customer info cho response
      await savedRoom.populate('customer_id', 'username email avatar_url');

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Chat room created successfully',
        data: savedRoom
      });

    } catch (error) {
      console.error('Create chat room error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Lấy danh sách chat rooms (cho customer và staff)
  async getChatRooms(req, res) {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      const userRole = req.userData.role;
      const userId = req.user.userId;

      let filter = {};
      let sortOrder = { last_message_at: -1 }; // Mặc định sort theo tin nhắn cuối

      // Logic phân quyền
      if (userRole === 'User') {
        // Customer chỉ thấy rooms của mình
        filter.customer_id = userId;
      } else if (['Staff', 'Admin'].includes(userRole)) {
        // Staff/Admin logic
        if (status === 'pending') {
          // Chỉ lấy rooms chờ assign
          filter.status = 'waiting';
          sortOrder = { created_at: 1 }; // Room cũ nhất lên đầu
        } else if (status === 'assigned') {
          // Chỉ lấy rooms đã assign cho staff này
          filter.assigned_staff_id = userId;
        } else {
          // Lấy tất cả rooms staff có thể thấy
          filter.$or = [
            { assigned_staff_id: userId }, // Rooms đã assign
            { status: 'waiting' } // Rooms chờ assign
          ];
        }
      } else {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'Access denied',
          data: null
        });
      }

      // Thêm filter theo status nếu có
      if (status && status !== 'pending' && status !== 'assigned') {
        filter.status = status;
      }

      // Pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Execute query với populate
      const rooms = await ChatRoom.find(filter)
        .populate('customer_id', 'username email avatar_url')
        .populate('assigned_staff_id', 'username email')
        .sort(sortOrder)
        .skip(skip)
        .limit(Number(limit))
        .lean();

      // Đếm tổng số records
      const totalCount = await ChatRoom.countDocuments(filter);

      // Lấy tin nhắn cuối cùng cho mỗi room
      const roomsWithLastMessage = await Promise.all(
        rooms.map(async (room) => {
          const lastMessage = await ChatMessage.getLastMessageInRoom(room._id);
          return {
            ...room,
            last_message: lastMessage
          };
        })
      );

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Chat rooms retrieved successfully',
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
      console.error('Get chat rooms error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Lấy lịch sử chat của một room
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

      // Kiểm tra quyền truy cập room
      const hasAccess = room.hasAccess(userId, userRole);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'Access denied to this chat room',
          data: null
        });
      }

      // Pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Lấy messages với populate sender info
      const messages = await ChatMessage.find({ room_id: roomId })
        .populate('sender_id', 'username avatar_url role')
        .sort({ created_at: -1 }) // Mới nhất lên đầu
        .skip(skip)
        .limit(Number(limit))
        .lean();

      // Đếm tổng số messages
      const totalCount = await ChatMessage.countDocuments({ room_id: roomId });

      // Đếm tin nhắn chưa đọc của user này
      const unreadCount = await ChatMessage.countUnreadInRoom(roomId, userId);

      // Populate room info
      await room.populate([
        { path: 'customer_id', select: 'username email avatar_url' },
        { path: 'assigned_staff_id', select: 'username email' }
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Chat history retrieved successfully',
        data: {
          room: room,
          messages: messages.reverse(), // Reverse để hiển thị từ cũ đến mới
          unread_count: unreadCount,
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

  // Staff assign room cho bản thân
  async assignRoom(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.userId;
      const userRole = req.userData.role;

      // Chỉ Staff/Admin mới assign được
      if (!['Staff', 'Admin'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'Access denied. Staff or Admin role required.',
          data: null
        });
      }

      // Tìm room
      const room = await ChatRoom.findById(roomId);
      if (!room) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Chat room not found',
          data: null
        });
      }

      // Kiểm tra room có đang chờ hoặc chưa assign không
      if (room.assigned_staff_id && room.assigned_staff_id.toString() !== userId) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Room is already assigned to another staff member',
          data: null
        });
      }

      // Assign room
      room.assigned_staff_id = userId;
      room.status = 'active';
      room.updated_at = new Date();
      
      await room.save();

      // Populate staff info
      await room.populate([
        { path: 'customer_id', select: 'username email avatar_url' },
        { path: 'assigned_staff_id', select: 'username email' }
      ]);

      // Tạo system message thông báo staff đã join
      const systemMessage = new ChatMessage({
        room_id: roomId,
        sender_id: userId,
        content: `${req.userData.username} has joined the chat`,
        message_type: 'system'
      });
      await systemMessage.save();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Room assigned successfully',
        data: room
      });

    } catch (error) {
      console.error('Assign room error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Đóng room
  async closeRoom(req, res) {
    try {
      const { roomId } = req.params;
      const { reason } = req.body;
      const userId = req.user.userId;
      const userRole = req.userData.role;

      // Tìm room
      const room = await ChatRoom.findById(roomId);
      if (!room) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Chat room not found',
          data: null
        });
      }

      // Kiểm tra quyền đóng room
      const canClose = userRole === 'Admin' || 
                      (userRole === 'Staff' && room.assigned_staff_id?.toString() === userId) ||
                      (userRole === 'User' && room.customer_id.toString() === userId);

      if (!canClose) {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'You do not have permission to close this room',
          data: null
        });
      }

      // Đóng room
      room.status = 'closed';
      room.updated_at = new Date();
      await room.save();

      // Tạo system message thông báo đóng room
      const systemMessage = new ChatMessage({
        room_id: roomId,
        sender_id: userId,
        content: reason ? `Room closed: ${reason}` : 'Room has been closed',
        message_type: 'system'
      });
      await systemMessage.save();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Room closed successfully',
        data: room
      });

    } catch (error) {
      console.error('Close room error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Đánh dấu tin nhắn đã đọc
  async markAsRead(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user.userId;

      // Tìm message
      const message = await ChatMessage.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Message not found',
          data: null
        });
      }

      // Kiểm tra quyền truy cập room
      const room = await ChatRoom.findById(message.room_id);
      if (!room || !room.hasAccess(userId, req.userData.role)) {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'Access denied',
          data: null
        });
      }

      // Đánh dấu đã đọc
      await message.markAsReadBy(userId);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Message marked as read',
        data: null
      });

    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Đếm tin nhắn chưa đọc của user
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.userId;
      const userRole = req.userData.role;

      let totalUnread = 0;
      let roomsWithUnread = [];

      if (userRole === 'User') {
        // Customer: đếm trong rooms của mình
        const customerRooms = await ChatRoom.find({ 
          customer_id: userId,
          status: { $in: ['waiting', 'active'] }
        });

        for (const room of customerRooms) {
          const unreadCount = await ChatMessage.countUnreadInRoom(room._id, userId);
          if (unreadCount > 0) {
            roomsWithUnread.push({
              room_id: room._id,
              unread_count: unreadCount
            });
            totalUnread += unreadCount;
          }
        }

      } else if (['Staff', 'Admin'].includes(userRole)) {
        // Staff: đếm trong rooms được assign
        const assignedRooms = await ChatRoom.find({ 
          assigned_staff_id: userId,
          status: 'active'
        });

        for (const room of assignedRooms) {
          const unreadCount = await ChatMessage.countUnreadInRoom(room._id, userId);
          if (unreadCount > 0) {
            roomsWithUnread.push({
              room_id: room._id,
              unread_count: unreadCount
            });
            totalUnread += unreadCount;
          }
        }
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Unread count retrieved successfully',
        data: {
          total_unread: totalUnread,
          rooms_with_unread: roomsWithUnread
        }
      });

    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Method để gửi tin nhắn (sẽ được Socket.IO sử dụng, không expose qua REST API)
  async createMessage(roomId, senderId, content, messageType = 'text') {
    try {
      const room = await ChatRoom.findById(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const message = new ChatMessage({
        room_id: roomId,
        sender_id: senderId,
        content: content,
        message_type: messageType
      });

      const savedMessage = await message.save();

      // Cập nhật last_message_at của room
      await ChatRoom.findByIdAndUpdate(roomId, {
        last_message_at: new Date()
      });

      // Populate sender info
      await savedMessage.populate('sender_id', 'username avatar_url role');

      return savedMessage;

    } catch (error) {
      console.error('Create message error:', error);
      throw error;
    }
  }
}

// Export controller instance với methods đã bind
const chatController = new ChatController();

module.exports = {
  createChatRoom: chatController.createChatRoom.bind(chatController),
  getChatRooms: chatController.getChatRooms.bind(chatController),
  getChatHistory: chatController.getChatHistory.bind(chatController),
  assignRoom: chatController.assignRoom.bind(chatController),
  closeRoom: chatController.closeRoom.bind(chatController),
  markAsRead: chatController.markAsRead.bind(chatController),
  getUnreadCount: chatController.getUnreadCount.bind(chatController),
  
  // Internal method cho Socket.IO (không expose qua routes)
  createMessage: chatController.createMessage.bind(chatController)
};