// src/middleware/adminCareServiceValidation.js
const { body, query, param, validationResult } = require('express-validator');

// Middleware để handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array()
    });
  }
  next();
};

// Validation cho get all services (Admin)
const validateGetAllServices = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Trang phải là số nguyên dương'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Giới hạn phải từ 1-100'),
  
  query('category')
    .optional()
    .isIn(['grooming', 'health', 'bathing', 'spa', 'other', 'all'])
    .withMessage('Danh mục không hợp lệ'),
  
  query('active')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Trạng thái active phải là true hoặc false'),
  
  query('search')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Từ khóa tìm kiếm phải từ 1-255 ký tự'),
  
  query('sort_by')
    .optional()
    .isIn(['name', 'price', 'duration', 'category', 'created_at', 'updated_at'])
    .withMessage('Trường sắp xếp không hợp lệ'),
  
  query('sort_order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Thứ tự sắp xếp phải là asc hoặc desc'),
  
  handleValidationErrors
];

// Validation cho create service (Admin)
const validateCreateService = [
  body('name')
    .notEmpty()
    .withMessage('Tên dịch vụ là bắt buộc')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên dịch vụ phải từ 2-100 ký tự')
    .trim(),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Mô tả không được vượt quá 1000 ký tự')
    .trim(),
  
  body('price')
    .notEmpty()
    .withMessage('Giá dịch vụ là bắt buộc')
    .isNumeric()
    .withMessage('Giá phải là số')
    .custom((value) => {
      if (parseFloat(value) < 0) {
        throw new Error('Giá dịch vụ không thể âm');
      }
      return true;
    }),
  
  body('duration')
    .notEmpty()
    .withMessage('Thời gian thực hiện là bắt buộc')
    .isInt({ min: 15, max: 480 })
    .withMessage('Thời gian thực hiện phải từ 15-480 phút'),
  
  body('category')
    .notEmpty()
    .withMessage('Danh mục là bắt buộc')
    .isIn(['grooming', 'health', 'bathing', 'spa', 'other'])
    .withMessage('Danh mục không hợp lệ'),
  
  handleValidationErrors
];

// Validation cho update service (Admin)
const validateUpdateService = [
  param('id')
    .isMongoId()
    .withMessage('ID dịch vụ không hợp lệ'),
  
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Tên dịch vụ không được để trống')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên dịch vụ phải từ 2-100 ký tự')
    .trim(),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Mô tả không được vượt quá 1000 ký tự')
    .trim(),
  
  body('price')
    .optional()
    .isNumeric()
    .withMessage('Giá phải là số')
    .custom((value) => {
      if (parseFloat(value) < 0) {
        throw new Error('Giá dịch vụ không thể âm');
      }
      return true;
    }),
  
  body('duration')
    .optional()
    .isInt({ min: 15, max: 480 })
    .withMessage('Thời gian thực hiện phải từ 15-480 phút'),
  
  body('category')
    .optional()
    .isIn(['grooming', 'health', 'bathing', 'spa', 'other'])
    .withMessage('Danh mục không hợp lệ'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('Trạng thái active phải là boolean'),
  
  // Validate that at least one field is provided
  body()
    .custom((value) => {
      const allowedFields = ['name', 'description', 'price', 'duration', 'category', 'is_active'];
      const providedFields = Object.keys(value).filter(key => allowedFields.includes(key));
      
      if (providedFields.length === 0) {
        throw new Error('Phải cung cấp ít nhất một trường để cập nhật');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validation cho delete service (Admin)
const validateDeleteService = [
  param('id')
    .isMongoId()
    .withMessage('ID dịch vụ không hợp lệ'),
  
  handleValidationErrors
];

// Validation cho get service details (Admin)
const validateGetServiceDetails = [
  param('id')
    .isMongoId()
    .withMessage('ID dịch vụ không hợp lệ'),
  
  handleValidationErrors
];

// Validation cho bulk update services (Admin)
const validateBulkUpdateServices = [
  body('service_ids')
    .isArray({ min: 1, max: 50 })
    .withMessage('Danh sách ID dịch vụ phải là mảng từ 1-50 phần tử'),
  
  body('service_ids.*')
    .isMongoId()
    .withMessage('ID dịch vụ không hợp lệ'),
  
  body('updates')
    .isObject()
    .withMessage('Dữ liệu cập nhật phải là object')
    .custom((value) => {
      const allowedKeys = ['category', 'is_active', 'price'];
      const providedKeys = Object.keys(value);
      
      if (providedKeys.length === 0) {
        throw new Error('Phải có ít nhất một trường để cập nhật');
      }
      
      const invalidKeys = providedKeys.filter(key => !allowedKeys.includes(key));
      if (invalidKeys.length > 0) {
        throw new Error(`Trường không được phép: ${invalidKeys.join(', ')}`);
      }
      
      return true;
    }),
  
  body('updates.category')
    .optional()
    .isIn(['grooming', 'health', 'bathing', 'spa', 'other'])
    .withMessage('Danh mục không hợp lệ'),
  
  body('updates.is_active')
    .optional()
    .isBoolean()
    .withMessage('Trạng thái active phải là boolean'),
  
  body('updates.price')
    .optional()
    .isNumeric()
    .withMessage('Giá phải là số')
    .custom((value) => {
      if (parseFloat(value) < 0) {
        throw new Error('Giá dịch vụ không thể âm');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validation cho get service statistics (Admin)
const validateGetServiceStatistics = [
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('Định dạng ngày bắt đầu không hợp lệ'),
  
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('Định dạng ngày kết thúc không hợp lệ')
    .custom((value, { req }) => {
      if (req.query.date_from && value) {
        const dateFrom = new Date(req.query.date_from);
        const dateTo = new Date(value);
        
        if (dateTo < dateFrom) {
          throw new Error('Ngày kết thúc không thể trước ngày bắt đầu');
        }
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validation cho toggle service status (Admin)
const validateToggleServiceStatus = [
  param('id')
    .isMongoId()
    .withMessage('ID dịch vụ không hợp lệ'),
  
  handleValidationErrors
];

module.exports = {
  validateGetAllServices,
  validateCreateService,
  validateUpdateService,
  validateDeleteService,
  validateGetServiceDetails,
  validateBulkUpdateServices,
  validateGetServiceStatistics,
  validateToggleServiceStatus,
  handleValidationErrors
};