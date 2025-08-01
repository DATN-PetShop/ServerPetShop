// src/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  startChat,
  getChatHistory,
  getRooms,
  uploadImage
} = require('../controllers/chatController');

// ================================
// SIMPLIFIED CHAT ROUTES - CHỈ 4 ENDPOINTS
// ================================

// 1. Bắt đầu chat (Customer only)
// POST /api/chat/start
router.post('/start', auth, startChat);

// 2. Lấy lịch sử chat (Customer và Staff)
// GET /api/chat/history/:roomId
router.get('/history/:roomId', auth, getChatHistory);

// 3. Lấy danh sách rooms (Staff/Admin only)
// GET /api/chat/rooms
router.get('/rooms', auth, getRooms);

// 4. Upload ảnh cho chat
// POST /api/chat/upload-image
router.post('/upload-image', auth, upload.single('image'), uploadImage);

module.exports = router;