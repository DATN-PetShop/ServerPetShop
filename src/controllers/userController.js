// src/controllers/userController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
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
    const token = generateToken(savedUser._id);

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
    const token = generateToken(user._id);

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
    
    if (user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: 'Access denied. Admin role required.',
        data: null
      });
    }

    //const allUsers = await User.find().select('-password_hash').sort({ created_at: -1 });

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
    
    if (!['Staff', 'Admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: 'Access denied. Staff or Admin role required.',
        data: null
      });
    }

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

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  adminRoute,
  staffRoute
};