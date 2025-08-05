// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Access denied. No token provided or invalid format.',
        data: null
      });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId).select('-password_hash');
    if (!user) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Token is valid but user not found.',
        data: null
      });
    }

    // ✅ Kiểm tra trạng thái user trước khi cho phép truy cập
    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: 'Your account has been banned. Please contact support.',
        data: null
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: 'Your account has been suspended. Please contact support.',
        data: null
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: 'Your account is inactive. Please contact support to activate.',
        data: null
      });
    }

    req.user = decoded;
    req.user.id = decoded.userId;
    req.userData = user;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Invalid token.',
        data: null
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Token has expired.',
        data: null
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error.',
      data: null
    });
  }
};

module.exports = auth;