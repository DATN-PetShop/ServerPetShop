// src/routes/categoryRoutes.js - Enhanced with debugging
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const upload = require('../middleware/upload');
const {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');

// ✅ Enhanced logging middleware for debugging
const debugMiddleware = (operation) => (req, res, next) => {
  console.log(`\n🔍 [${operation}] Category operation started`);
  console.log(`📋 Method: ${req.method}`);
  console.log(`📍 URL: ${req.originalUrl}`);
  console.log(`📦 Body:`, req.body);
  console.log(`📸 Files:`, req.files ? req.files.length : 0);
  console.log(`👤 User:`, req.userData ? {
    id: req.userData._id,
    role: req.userData.role,
    username: req.userData.username
  } : 'Not authenticated');
  
  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    console.log(`📤 [${operation}] Response:`, {
      statusCode: res.statusCode,
      success: data?.success,
      message: data?.message,
      dataLength: data?.data ? (Array.isArray(data.data) ? data.data.length : 'object') : 'none'
    });
    return originalJson.call(this, data);
  };
  
  next();
};

// Public routes
router.get('/', debugMiddleware('GET_ALL'), getAllCategories);
router.get('/:id', debugMiddleware('GET_BY_ID'), getCategoryById);

// Admin only routes - Enhanced with debugging
router.post('/', 
  debugMiddleware('CREATE'),
  auth, 
  requireRoles(['Admin']), 
  upload.array('images', 5), 
  (req, res, next) => {
    console.log('✅ Passed auth and role check for CREATE');
    console.log('📸 Upload middleware processed files:', req.files?.length || 0);
    next();
  },
  createCategory
);

router.put('/:id', 
  debugMiddleware('UPDATE'),
  auth, 
  requireRoles(['Admin']), 
  upload.array('images', 5),
  (req, res, next) => {
    console.log('✅ Passed auth and role check for UPDATE');
    console.log('📸 Upload middleware processed files:', req.files?.length || 0);
    console.log('🆔 Category ID:', req.params.id);
    next();
  },
  updateCategory
);

router.delete('/:id', 
  debugMiddleware('DELETE'),
  auth, 
  requireRoles(['Admin']),
  (req, res, next) => {
    console.log('✅ Passed auth and role check for DELETE');
    console.log('🆔 Category ID:', req.params.id);
    next();
  },
  deleteCategory
);

// ✅ Error handling middleware specifically for category routes
router.use((error, req, res, next) => {
  console.error('❌ Category route error:', {
    message: error.message,
    stack: error.stack,
    route: req.originalUrl,
    method: req.method
  });
  
  res.status(500).json({
    success: false,
    statusCode: 500,
    message: 'Category route error: ' + error.message,
    data: null
  });
});

module.exports = router;