// src/socket/simpleChatSocket.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const { createMessage } = require('../controllers/chatController');
const { sendNotificationToUser } = require('../controllers/pushTokenController');

class SimpleChatSocket {
  constructor(io) {
    this.io = io;
    this.activeUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> user info
    this.setupSocketEvents();
  }

  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log('🔌 User connected:', socket.id);

      // 1. Authentication
      socket.on('authenticate', async (data) => {
        await this.handleAuthentication(socket, data);
      });

      // 2. Join chat room
      socket.on('join_chat', async (data) => {
        await this.handleJoinChat(socket, data);
      });

      // 3. Send message (text hoặc image)
      socket.on('send_message', async (data) => {
        await this.handleSendMessage(socket, data);
      });

      // 4. Disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  // Xử lý authentication
  async handleAuthentication(socket, data) {
    try {
      const { token } = data;

      if (!token) {
        socket.emit('auth_error', { message: 'Token is required' });
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user info
      const user = await User.findById(decoded.userId).select('-password_hash');
      if (!user) {
        socket.emit('auth_error', { message: 'User not found' });
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

      socket.emit('authenticated', { 
        success: true,
        user: {
          id: socket.userId,
          username: socket.username,
          role: socket.userRole
        }
      });

      console.log(`✅ User authenticated: ${socket.username} (${socket.userRole})`);

    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('auth_error', { 
        message: error.name === 'JsonWebTokenError' ? 'Invalid token' : 'Authentication failed'
      });
    }
  }

  // Xử lý join chat room
  async handleJoinChat(socket, data) {
    try {
      const { roomId } = data;

      if (!socket.userId) {
        socket.emit('error', { message: 'Please authenticate first' });
        return;
      }

      // Verify room exists and user has access
      const room = await ChatRoom.findById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Chat room not found' });
        return;
      }

      // Check access permission
      const hasAccess = room.hasAccess(socket.userId, socket.userRole);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to this room' });
        return;
      }

      // Join socket room
      socket.join(`room_${roomId}`);
      socket.currentRoom = roomId;

      // Notify others in room
      socket.to(`room_${roomId}`).emit('user_joined', {
        userId: socket.userId,
        username: socket.username,
        role: socket.userRole,
        message: `${socket.username} joined the chat`
      });

      socket.emit('room_joined', { 
        roomId: roomId,
        message: 'Successfully joined chat room'
      });

      console.log(`📥 ${socket.username} joined room ${roomId}`);

    } catch (error) {
      console.error('Join chat error:', error);
      socket.emit('error', { message: 'Failed to join chat room' });
    }
  }

  // Xử lý gửi tin nhắn
  async handleSendMessage(socket, data) {
    try {
      const { roomId, content, messageType = 'text', imageUrl = null } = data;

      if (!socket.userId) {
        socket.emit('error', { message: 'Please authenticate first' });
        return;
      }

      if (!roomId || !content?.trim()) {
        socket.emit('error', { message: 'roomId and content are required' });
        return;
      }

      // Verify room access
      const room = await ChatRoom.findById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Chat room not found' });
        return;
      }

      const hasAccess = room.hasAccess(socket.userId, socket.userRole);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to this room' });
        return;
      }

      // Create message using controller
      const message = await createMessage(
        roomId, 
        socket.userId, 
        content.trim(), 
        messageType,
        imageUrl,
        socket.userRole
      );

      // Broadcast message to all users in room (including sender)
      this.io.to(`room_${roomId}`).emit('new_message', {
        id: message._id,
        room_id: message.room_id,
        content: message.content,
        message_type: message.message_type,
        image_url: message.image_url,
        sender: {
          id: message.sender_id._id,
          username: message.sender_id.username,
          role: message.sender_id.role,
          avatar_url: message.sender_id.avatar_url
        },
        sender_role: message.sender_role,
        created_at: message.created_at
      });

      // 🔔 GỬI PUSH NOTIFICATION CHO USER OFFLINE
      await this.sendPushNotificationToOfflineUsers(room, message);

      // Confirm to sender
      socket.emit('message_sent', {
        messageId: message._id,
        success: true
      });

      console.log(`💬 Message from ${socket.username} in room ${roomId}: ${content.substring(0, 50)}...`);

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  // Xử lý disconnect
  handleDisconnect(socket) {
    const userInfo = this.userSockets.get(socket.id);
    
    if (userInfo) {
      // Remove from active users
      this.activeUsers.delete(userInfo.userId);
      this.userSockets.delete(socket.id);

      // Notify current room if any
      if (socket.currentRoom) {
        socket.to(`room_${socket.currentRoom}`).emit('user_left', {
          userId: userInfo.userId,
          username: userInfo.username,
          message: `${userInfo.username} left the chat`
        });
      }

      console.log(`🔌 User disconnected: ${userInfo.username}`);
    }
  }

  // 🔔 GỬI PUSH NOTIFICATION CHO USER OFFLINE
  async sendPushNotificationToOfflineUsers(room, message) {
    try {
      // Lấy thông tin room với customer
      await room.populate('customer_id', '_id username');
      
      const senderId = message.sender_id._id.toString();
      const customerId = room.customer_id._id.toString();
      
      // Xác định người nhận (không phải người gửi)
      let recipientId = null;
      let notificationTitle = '';
      let notificationBody = '';
      
      if (senderId === customerId) {
        // Customer gửi → thông báo cho Staff/Admin
        // Tìm staff online, nếu không có thì gửi push notification cho tất cả staff
        const onlineStaff = Array.from(this.userSockets.values())
          .filter(user => ['Staff', 'Admin'].includes(user.role));
          
        if (onlineStaff.length === 0) {
          // Không có staff online → gửi notification cho tất cả staff
          const User = require('../models/User');
          const staffUsers = await User.find({ role: { $in: ['Staff', 'Admin'] } });
          
          for (const staff of staffUsers) {
            await sendNotificationToUser(staff._id.toString(), {
              title: '💬 Tin nhắn mới từ khách hàng',
              body: `${room.customer_id.username}: ${message.content}`,
              type: 'chat_message',
              relatedEntityId: room._id.toString(),
              relatedEntityType: 'ChatRoom',
              data: {
                roomId: room._id.toString(),
                customerId: customerId,
                customerName: room.customer_id.username
              }
            });
          }
          
          console.log(`🔔 Push notification sent to all staff for customer message`);
        }
        
      } else {
        // Staff/Admin gửi → thông báo cho Customer (nếu offline)
        recipientId = customerId;
        notificationTitle = '💬 Tin nhắn từ hỗ trợ';
        notificationBody = `${message.sender_id.username}: ${message.content}`;
        
        // Kiểm tra customer có online không
        const isCustomerOnline = this.isUserOnline(customerId);
        
        if (!isCustomerOnline) {
          await sendNotificationToUser(recipientId, {
            title: notificationTitle,
            body: notificationBody,
            type: 'chat_message',
            relatedEntityId: room._id.toString(),
            relatedEntityType: 'ChatRoom',
            data: {
              roomId: room._id.toString(),
              staffId: senderId,
              staffName: message.sender_id.username
            }
          });
          
          console.log(`🔔 Push notification sent to offline customer: ${room.customer_id.username}`);
        }
      }
      
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // Utility methods
  
  // Check if user is online
  isUserOnline(userId) {
    return this.activeUsers.has(userId);
  }

  // Send message to specific user (if online)
  sendToUser(userId, event, data) {
    const socketId = this.activeUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true; // User was online and received message
    }
    return false; // User was offline
  }

  // Send to all users in a room
  sendToRoom(roomId, event, data) {
    this.io.to(`room_${roomId}`).emit(event, data);
  }

  // Get online users count
  getOnlineUsersCount() {
    return this.activeUsers.size;
  }

  // Get online staff count
  getOnlineStaffCount() {
    let count = 0;
    this.userSockets.forEach(user => {
      if (['Staff', 'Admin'].includes(user.role)) {
        count++;
      }
    });
    return count;
  }
}

module.exports = SimpleChatSocket;
