// src/routes/userRoutes.js - ENHANCED VERSION
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const upload = require('../middleware/upload');
const {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  adminRoute,
  staffRoute,
  getAllUsers,
  getStaffUsers, // Import function mới
  getCustomerUsers, // Import function mới,
  updateCustomerStatus, // Import function mới
  getUserById,
  updateUser,
  deleteUser,
  changePassword
} = require('../controllers/userController');

// ================================================================
// ============== THÊM MỚI: PROFILE MANAGEMENT ROUTES ============
// ================================================================

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private (Any authenticated user)
router.get('/profile', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.userId).select('-password_hash');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'User not found',
        data: null
      });
    }

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Profile retrieved successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Update current user profile
// @route   PUT /api/users/profile
// @access  Private (Any authenticated user)
router.put('/profile', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const { username, email, phone, full_name, avatar } = req.body;
    const userId = req.user.userId;

    // Kiểm tra username đã tồn tại (nếu thay đổi)
    if (username) {
      const existingUser = await User.findOne({ 
        username, 
        _id: { $ne: userId } 
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Username already exists',
          data: null
        });
      }
    }

    // Kiểm tra email đã tồn tại (nếu thay đổi)
    if (email) {
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: userId } 
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Email already exists',
          data: null
        });
      }
    }

    // Cập nhật thông tin
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (full_name !== undefined) updateData.full_name = full_name;
    if (avatar !== undefined) updateData.avatar = avatar;
    updateData.updated_at = new Date();

    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      updateData, 
      { new: true }
    ).select('-password_hash');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'User not found',
        data: null
      });
    }

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Change password
// @route   POST /api/users/change-password
// @access  Private (Any authenticated user)
router.post('/change-password', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const bcrypt = require('bcryptjs');
    const { current_password, new_password } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Current password and new password are required',
        data: null
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'New password must be at least 6 characters long',
        data: null
      });
    }

    // Tìm user và kiểm tra mật khẩu hiện tại
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'User not found',
        data: null
      });
    }

    // Kiểm tra mật khẩu hiện tại
    const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Current password is incorrect',
        data: null
      });
    }

    // Mã hóa mật khẩu mới
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(new_password, saltRounds);

    // Cập nhật mật khẩu
    await User.findByIdAndUpdate(userId, {
      password_hash: hashedNewPassword,
      updated_at: new Date()
    });

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Password changed successfully',
      data: null
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Upload avatar
// @route   POST /api/users/upload-avatar
// @access  Private (Any authenticated user)
router.post('/upload-avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    const User = require('../models/User');
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'No avatar file provided',
        data: null
      });
    }

    // Tạo URL cho avatar (giả sử bạn có cấu hình upload)
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Cập nhật avatar URL trong database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        avatar: avatarUrl,
        updated_at: new Date()
      },
      { new: true }
    ).select('-password_hash');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'User not found',
        data: null
      });
    }

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Avatar uploaded successfully',
      data: { 
        avatar_url: avatarUrl,
        user: updatedUser 
      }
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Check if email exists
// @route   GET /api/users/check-email
// @access  Private (Admin/Staff only)
router.get('/check-email', auth, requireRoles(['Admin', 'Staff']), async (req, res) => {
  try {
    const User = require('../models/User');
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Email parameter is required',
        data: null
      });
    }

    const existingUser = await User.findOne({ email }).select('_id');
    
    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Email check completed',
      data: { exists: !!existingUser }
    });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Check if username exists
// @route   GET /api/users/check-username
// @access  Private (Admin/Staff only)
router.get('/check-username', auth, requireRoles(['Admin', 'Staff']), async (req, res) => {
  try {
    const User = require('../models/User');
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Username parameter is required',
        data: null
      });
    }

    const existingUser = await User.findOne({ username }).select('_id');
    
    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Username check completed',
      data: { exists: !!existingUser }
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ================================================================
// ============== EXISTING ROUTES (GIỮ NGUYÊN) ===================
// ================================================================

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', auth, logoutUser);

// Protected routes
router.get('/me', auth, getCurrentUser);

// Admin routes
router.put('/change-password', auth, changePassword);
router.get('/admin', auth, requireRoles(['Admin']), adminRoute);
router.get('/staff', auth, requireRoles(['Staff', 'Admin']), staffRoute);

// User management (Admin/Staff only)
router.get('/', auth, requireRoles(['Admin', 'Staff']), getAllUsers);
router.get('/:id', auth, requireRoles(['Admin', 'Staff']), getUserById);
router.put('/:id', auth, requireRoles(['Admin', 'Staff']), updateUser);
router.get('/', auth, requireRoles(['Admin']), getAllUsers);
router.get('/staff-only', auth, requireRoles(['Admin']), getStaffUsers); // Route mới
router.get('/customers', auth, requireRoles(['Admin', 'Staff']), getCustomerUsers);     // ← Route mới
router.patch('/:id/status', auth, requireRoles(['Admin']), updateCustomerStatus); // ← Route mới

router.get('/:id', auth, requireRoles(['Admin', 'Staff']), getUserById);
router.put('/:id', auth, updateUser);
router.delete('/:id', auth, requireRoles(['Admin']), deleteUser);

module.exports = router;