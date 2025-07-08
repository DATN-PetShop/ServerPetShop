// src/socket/chatSocketHandler.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const { createMessage } = require('../controllers/chatController');

class ChatSocketHandler {
  constructor(io) {
    this.io = io;
    this.activeUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> user info
    this.setupSocketEvents();
  }

  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log('🔌 User connected:', socket.id);

      // Authentication event
      socket.on('authenticate', async (data) => {
        await this.handleAuthentication(socket, data);
      });

      // Join room event
      socket.on('join_room', async (data) => {
        await this.handleJoinRoom(socket, data);
      });

      // Send message event
      socket.on('send_message', async (data) => {
        await this.handleSendMessage(socket, data);
      });

      // Typing indicator events
      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      // Leave room event
      socket.on('leave_room', (data) => {
        this.handleLeaveRoom(socket, data);
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

      // Join appropriate groups based on role
      if (['Staff', 'Admin'].includes(socket.userRole)) {
        socket.join('staff_room');
        console.log(`👮 Staff ${socket.username} joined staff room`);
        
        // Notify about pending rooms
        await this.notifyPendingRooms(socket);
      }

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

  async handleJoinRoom(socket, data) {
    try {
      const { roomId } = data;

      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Verify room exists and user has access
      const room = await ChatRoom.findById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
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
      
      // Store current room in socket
      socket.currentRoom = roomId;

      // Notify room about user joining
      socket.to(`room_${roomId}`).emit('user_joined', {
        userId: socket.userId,
        username: socket.username,
        role: socket.userRole
      });

      socket.emit('room_joined', { 
        roomId: roomId,
        message: 'Successfully joined room'
      });

      console.log(`📥 ${socket.username} joined room ${roomId}`);

    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  async handleSendMessage(socket, data) {
    try {
      const { roomId, content, messageType = 'text' } = data;

      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      if (!content || !content.trim()) {
        socket.emit('error', { message: 'Message content is required' });
        return;
      }

      // Verify room access
      const room = await ChatRoom.findById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const hasAccess = room.hasAccess(socket.userId, socket.userRole);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to this room' });
        return;
      }

      // Create message using controller method
      const message = await createMessage(roomId, socket.userId, content.trim(), messageType);

      // Message will be broadcasted via Change Stream
      // But we can emit immediate confirmation to sender
      socket.emit('message_sent', {
        messageId: message._id,
        timestamp: message.createdAt
      });

      console.log(`💬 Message from ${socket.username} in room ${roomId}: ${content.substring(0, 50)}...`);

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  handleTypingStart(socket, data) {
    const { roomId } = data;
    
    if (!socket.userId || !roomId) return;

    socket.to(`room_${roomId}`).emit('user_typing', {
      userId: socket.userId,
      username: socket.username,
      isTyping: true
    });
  }

  handleTypingStop(socket, data) {
    const { roomId } = data;
    
    if (!socket.userId || !roomId) return;

    socket.to(`room_${roomId}`).emit('user_typing', {
      userId: socket.userId,
      username: socket.username,
      isTyping: false
    });
  }

  handleLeaveRoom(socket, data) {
    const { roomId } = data;
    
    if (!roomId) return;

    socket.leave(`room_${roomId}`);
    
    // Notify others in room
    socket.to(`room_${roomId}`).emit('user_left', {
      userId: socket.userId,
      username: socket.username
    });

    // Clear current room
    if (socket.currentRoom === roomId) {
      socket.currentRoom = null;
    }

    console.log(`📤 ${socket.username} left room ${roomId}`);
  }

  handleDisconnect(socket) {
    const userInfo = this.userSockets.get(socket.id);
    
    if (userInfo) {
      // Remove from active users
      this.activeUsers.delete(userInfo.userId);
      this.userSockets.delete(socket.id);

      // Notify current room if any
      if (socket.currentRoom) {
        socket.to(`room_${socket.currentRoom}`).emit('user_disconnected', {
          userId: userInfo.userId,
          username: userInfo.username
        });
      }

      console.log(`🔌 User disconnected: ${userInfo.username}`);
    }
  }

  async notifyPendingRooms(socket) {
    try {
      const pendingRooms = await ChatRoom.find({ status: 'waiting' })
        .populate('customer_id', 'username email avatar_url')
        .sort({ created_at: 1 })
        .limit(10);

      socket.emit('pending_rooms', {
        rooms: pendingRooms,
        count: pendingRooms.length
      });

    } catch (error) {
      console.error('Error fetching pending rooms:', error);
    }
  }

  // Public methods for external use (Change Streams will call these)
  sendToRoom(roomId, event, data) {
    this.io.to(`room_${roomId}`).emit(event, data);
  }

  sendToStaff(event, data) {
    this.io.to('staff_room').emit(event, data);
  }

  sendToUser(userId, event, data) {
    const socketId = this.activeUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.activeUsers.has(userId);
  }

  // Get online users count
  getOnlineUsersCount() {
    return this.activeUsers.size;
  }

  // Get staff online count
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

module.exports = ChatSocketHandler;