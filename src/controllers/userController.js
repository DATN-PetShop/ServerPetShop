// src/controllers/userController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT Token
const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { username, email, password, role, phone } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Please provide username, email, and password',
        data: null
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        statusCode: 409,
        message: 'User with this email or username already exists',
        data: null
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      username,
      email,
      password_hash: hashedPassword,
      role: role || 'User',
      phone
    });

    const savedUser = await user.save();

    // Generate token
    const token = generateToken(savedUser._id, savedUser.role);

    // Return success response
    res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'User registered successfully',
      data: {
        token
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Please provide email and password',
        data: null
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Invalid email or password',
        data: null
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Invalid email or password',
        data: null
      });
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Login successful',
      data: {
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get current user
// @route   GET /api/users/me
// @access  Private
const getCurrentUser = async (req, res) => {
  try {
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
      message: 'User retrieved successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          phone: user.phone,
          avatar_url: user.avatar_url,
          created_at: user.created_at,
          updated_at: user.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Admin route
// @route   GET /api/users/admin
// @access  Private (Admin only)
const adminRoute = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password_hash');
    
    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Admin data retrieved successfully',
      data: {
        // totalUsers: allUsers.length,
        // users: allUsers,
        adminUser: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('Admin route error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Staff route
// @route   GET /api/users/staff
// @access  Private (Staff/Admin only)
const staffRoute = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password_hash');
    
    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Staff data retrieved successfully',
      data: {
        message: 'Welcome to staff area!',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        permissions: user.role === 'Admin' ? ['read', 'write', 'delete'] : ['read', 'write']
      }
    });

  } catch (error) {
    console.error('Staff route error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password_hash');
    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'All users retrieved successfully',
      data: { users }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private (Admin/Staff only)
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password_hash');
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
      message: 'User retrieved successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin/Staff only)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData.password_hash; // Không cho phép update password_hash trực tiếp
    const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password_hash');
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
      message: 'User updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
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
      message: 'User deleted successfully',
      data: null
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Please provide current password, new password, and confirm password',
        data: null
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'New password and confirm password do not match',
        data: null
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'New password must be at least 6 characters long',
        data: null
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'User not found',
        data: null
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Current password is incorrect',
        data: null
      });
    }

    // Check if new password is different from current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'New password must be different from current password',
        data: null
      });
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
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
};

// @desc    Logout user
// @route   POST /api/users/logout
// @access  Private
const logoutUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'User not found',
        data: null
      });
    }

    await User.findByIdAndUpdate(userId, {
      updated_at: new Date()
    });

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Logout successful',
      data: {
        message: 'Please remove the token from client-side storage'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
    });
  }
};

const getStaffUsers = async (req, res) => {
  try {
    const staffUsers = await User.find({ role: 'Staff' }).select('-password_hash').sort({ created_at: -1 });
    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Staff users retrieved successfully',
      data: { users: staffUsers }
    });
  } catch (error) {
    console.error('Get staff users error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
const getCustomerUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    
    // Build filter for customers (role = 'User')
    let filter = { role: 'User' };
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    // Execute query
    const customers = await User.find(filter)
      .select('-password_hash')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));
    
    // Get total count for pagination
    const totalCount = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / Number(limit));
    
    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Customer users retrieved successfully',
      data: { 
        users: customers,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalCount,
          limit: Number(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get customer users error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  adminRoute,
  staffRoute,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getStaffUsers,
  getCustomerUsers,
  changePassword,
};