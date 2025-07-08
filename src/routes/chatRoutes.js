// src/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Sử dụng middleware có sẵn
const requireRoles = require('../middleware/requireRole'); // Sử dụng middleware có sẵn
const {
  createChatRoom,
  getChatRooms,
  getChatHistory,
  assignRoom,
  closeRoom,
  markAsRead,
  getUnreadCount
} = require('../controllers/chatController');
const { createMessage } = require('../controllers/chatController');
// ================================
// CUSTOMER ROUTES (User role)
// ================================

// Tạo chat room mới
router.post('/rooms', auth, createChatRoom);

// Lấy danh sách rooms của customer
router.get('/rooms/my', auth, getChatRooms);

// Lấy lịch sử chat của một room
router.get('/messages/:roomId', auth, getChatHistory);

// Đánh dấu tin nhắn đã đọc
router.patch('/messages/:messageId/read', auth, markAsRead);

// Đếm tin nhắn chưa đọc
router.get('/unread-count', auth, getUnreadCount);

// ================================
// STAFF ROUTES (Staff/Admin roles)
// ================================

// Lấy danh sách rooms chờ assign (chỉ Staff/Admin)
router.get('/rooms/pending', auth, requireRoles(['Staff', 'Admin']), getChatRooms);

// Lấy danh sách rooms đã assign cho staff (chỉ Staff/Admin)
router.get('/rooms/assigned', auth, requireRoles(['Staff', 'Admin']), getChatRooms);

// Assign room cho staff (chỉ Staff/Admin)
router.patch('/rooms/:roomId/assign', auth, requireRoles(['Staff', 'Admin']), assignRoom);

// Đóng room (Staff/Admin hoặc Customer)
router.patch('/rooms/:roomId/close', auth, closeRoom);


// Lấy tất cả rooms (chỉ Admin)
router.get('/rooms/all', auth, requireRoles(['Admin']), getChatRooms);

router.post('/messages', auth, async (req, res) => {
  try {
    const { roomId, content, messageType = 'text' } = req.body;
    const userId = req.user.userId;
    const userRole = req.userData.role;

    console.log(`📤 REST API: ${userRole} sending message to room ${roomId}`);

    if (!roomId || !content?.trim()) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'roomId and content are required',
        data: null
      });
    }

    // Kiểm tra quyền truy cập room
    const ChatRoom = require('../models/ChatRoom');
    const room = await ChatRoom.findById(roomId);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Chat room not found',
        data: null
      });
    }

    // Kiểm tra permission
    const hasAccess = room.hasAccess(userId, userRole);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: 'Access denied to this room',
        data: null
      });
    }

    // Tạo message
    const message = await createMessage(roomId, userId, content.trim(), messageType);
    console.log(`✅ Message created with ID: ${message._id}`);

    // 🔥 CRITICAL: Broadcast qua Socket.IO
    const socketHandler = req.app.get('socketHandler');
    if (socketHandler && typeof socketHandler.broadcastNewMessage === 'function') {
      console.log('🔥 Attempting to broadcast message via REST API...');
      await socketHandler.broadcastNewMessage(message);
      console.log('✅ Message broadcasted via REST API');
    } else {
      console.log('❌ Socket handler not available for broadcast');
      console.log('📊 Available app properties:', Object.keys(req.app.settings || {}));
    }

    res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'Message sent successfully',
      data: message
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null
    });
  }
});

module.exports = router;