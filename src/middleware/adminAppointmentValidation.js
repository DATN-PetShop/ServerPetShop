// src/middleware/adminAppointmentValidation.js
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

// Validation cho update appointment status - ✅ CLEANED: Bỏ admin_notes
const validateUpdateStatus = [
  param('id')
    .isMongoId()
    .withMessage('ID lịch hẹn không hợp lệ'),
  
  body('status')
    .optional()
    .isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no-show'])
    .withMessage('Trạng thái không hợp lệ'),
  
  body('staff_id')
    .optional()
    .custom((value) => {
      if (value === '') return true; // Allow empty string to remove staff
      if (!value) return true; // Allow undefined/null
      return /^[0-9a-fA-F]{24}$/.test(value); // Check MongoDB ObjectId format
    })
    .withMessage('ID nhân viên không hợp lệ'),
  
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Ghi chú không được vượt quá 1000 ký tự'),
  
  // ✅ REMOVED: admin_notes validation
  
  handleValidationErrors
];

// Validation cho get all appointments - UNCHANGED
const validateGetAllAppointments = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Trang phải là số nguyên dương'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Giới hạn phải từ 1-100'),
  
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no-show'])
    .withMessage('Trạng thái không hợp lệ'),
  
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Định dạng ngày không hợp lệ'),
  
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('Định dạng ngày bắt đầu không hợp lệ'),
  
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('Định dạng ngày kết thúc không hợp lệ'),
  
  query('staff_id')
    .optional()
    .isMongoId()
    .withMessage('ID nhân viên không hợp lệ'),
  
  query('service_id')
    .optional()
    .isMongoId()
    .withMessage('ID dịch vụ không hợp lệ'),
  
  query('user_id')
    .optional()
    .isMongoId()
    .withMessage('ID người dùng không hợp lệ'),
  
  query('search')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Từ khóa tìm kiếm phải từ 1-255 ký tự'),
  
  query('sort_by')
    .optional()
    .isIn(['appointment_date', 'appointment_time', 'status', 'created_at', 'total_amount', 'customer_name', 'pet_name', 'service_name'])
    .withMessage('Trường sắp xếp không hợp lệ'),
  
  query('sort_order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Thứ tự sắp xếp phải là asc hoặc desc'),
  
  handleValidationErrors
];

// Validation cho get available staff - UNCHANGED
const validateGetAvailableStaff = [
  query('appointment_date')
    .notEmpty()
    .withMessage('Ngày hẹn là bắt buộc')
    .isISO8601()
    .withMessage('Định dạng ngày không hợp lệ')
    .custom((value) => {
      const appointmentDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (appointmentDate < today) {
        throw new Error('Ngày hẹn không thể trong quá khứ');
      }
      return true;
    }),
  
  query('appointment_time')
    .notEmpty()
    .withMessage('Giờ hẹn là bắt buộc')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Thời gian phải theo định dạng HH:MM')
    .custom((value) => {
      const [hours, minutes] = value.split(':').map(Number);
      if (hours < 8 || hours >= 17) {
        throw new Error('Giờ hẹn phải trong khung 8:00 - 17:00');
      }
      return true;
    }),
  
  query('service_id')
    .optional()
    .isMongoId()
    .withMessage('ID dịch vụ không hợp lệ'),
  
  handleValidationErrors
];

// Validation cho get appointments by date - UNCHANGED
const validateGetByDate = [
  query('date')
    .notEmpty()
    .withMessage('Ngày là bắt buộc')
    .isISO8601()
    .withMessage('Định dạng ngày không hợp lệ'),
  
  query('staff_id')
    .optional()
    .isMongoId()
    .withMessage('ID nhân viên không hợp lệ'),
  
  handleValidationErrors
];

// Validation cho bulk update - ✅ CLEANED: Thay admin_notes thành notes
const validateBulkUpdate = [
  body('appointment_ids')
    .isArray({ min: 1, max: 50 })
    .withMessage('Danh sách ID lịch hẹn phải là mảng từ 1-50 phần tử'),
  
  body('appointment_ids.*')
    .isMongoId()
    .withMessage('ID lịch hẹn không hợp lệ'),
  
  body('updates')
    .isObject()
    .withMessage('Dữ liệu cập nhật phải là object')
    .custom((value) => {
      const allowedKeys = ['status', 'staff_id', 'notes']; // ✅ CHANGED: admin_notes -> notes
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
  
  body('updates.status')
    .optional()
    .isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no-show'])
    .withMessage('Trạng thái không hợp lệ'),
  
  body('updates.staff_id')
    .optional()
    .custom((value) => {
      if (value === '') return true; // Allow empty string to remove staff
      if (!value) return true; // Allow undefined/null
      return /^[0-9a-fA-F]{24}$/.test(value); // Check MongoDB ObjectId format
    })
    .withMessage('ID nhân viên không hợp lệ'),
  
  body('updates.notes') // ✅ CHANGED: admin_notes -> notes
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Ghi chú không được vượt quá 1000 ký tự'),
  
  handleValidationErrors
];

// Validation cho appointment ID param - UNCHANGED
const validateAppointmentId = [
  param('id')
    .isMongoId()
    .withMessage('ID lịch hẹn không hợp lệ'),
  
  handleValidationErrors
];

// Validation cho create appointment - UNCHANGED
const validateCreateAppointment = [
  body('pet_id')
    .notEmpty()
    .withMessage('Pet ID là bắt buộc')
    .isMongoId()
    .withMessage('Pet ID không hợp lệ'),
  
  body('service_id')
    .notEmpty()
    .withMessage('Service ID là bắt buộc')
    .isMongoId()
    .withMessage('Service ID không hợp lệ'),
  
  body('appointment_date')
    .notEmpty()
    .withMessage('Ngày hẹn là bắt buộc')
    .isISO8601()
    .withMessage('Định dạng ngày không hợp lệ')
    .custom((value) => {
      const appointmentDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (appointmentDate < today) {
        throw new Error('Ngày hẹn không thể trong quá khứ');
      }
      return true;
    }),
  
  body('appointment_time')
    .notEmpty()
    .withMessage('Giờ hẹn là bắt buộc')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Định dạng giờ không hợp lệ (HH:MM)')
    .custom((value) => {
      const [hours, minutes] = value.split(':').map(Number);
      if (hours < 8 || hours >= 17) {
        throw new Error('Giờ hẹn phải trong khung 8:00 - 17:00');
      }
      return true;
    }),
  
  body('order_id')
    .notEmpty()
    .withMessage('Order ID là bắt buộc')
    .isMongoId()
    .withMessage('Order ID không hợp lệ'),
  
  body('total_amount')
    .notEmpty()
    .withMessage('Tổng tiền là bắt buộc')
    .isNumeric()
    .withMessage('Tổng tiền phải là số')
    .custom((value) => {
      if (parseFloat(value) <= 0) {
        throw new Error('Tổng tiền phải lớn hơn 0');
      }
      return true;
    }),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Ghi chú không được vượt quá 500 ký tự'),
  
  body('variant_id')
    .optional()
    .isMongoId()
    .withMessage('Variant ID không hợp lệ'),
  
  body('item_type')
    .optional()
    .isIn(['pet', 'product', 'variant'])
    .withMessage('Item type phải là: pet, product, hoặc variant'),
  
  handleValidationErrors
];

// Validation cho update appointment (user) - UNCHANGED
const validateUpdateAppointment = [
  param('id')
    .isMongoId()
    .withMessage('ID lịch hẹn không hợp lệ'),
  
  body('appointment_date')
    .optional()
    .isISO8601()
    .withMessage('Định dạng ngày không hợp lệ')
    .custom((value) => {
      const appointmentDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (appointmentDate < today) {
        throw new Error('Ngày hẹn không thể trong quá khứ');
      }
      return true;
    }),
  
  body('appointment_time')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Định dạng giờ không hợp lệ (HH:MM)')
    .custom((value) => {
      const [hours, minutes] = value.split(':').map(Number);
      if (hours < 8 || hours >= 17) {
        throw new Error('Giờ hẹn phải trong khung 8:00 - 17:00');
      }
      return true;
    }),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Ghi chú không được vượt quá 500 ký tự'),
  
  // Validate that at least one field is provided
  body()
    .custom((value) => {
      const allowedFields = ['appointment_date', 'appointment_time', 'notes'];
      const providedFields = Object.keys(value).filter(key => allowedFields.includes(key));
      
      if (providedFields.length === 0) {
        throw new Error('Phải cung cấp ít nhất một trường để cập nhật');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validation cho get available slots - UNCHANGED
const validateGetAvailableSlots = [
  query('date')
    .notEmpty()
    .withMessage('Ngày là bắt buộc')
    .isISO8601()
    .withMessage('Định dạng ngày không hợp lệ')
    .custom((value) => {
      const appointmentDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (appointmentDate < today) {
        throw new Error('Ngày không thể trong quá khứ');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validation cho get user appointments - UNCHANGED
const validateGetUserAppointments = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Trang phải là số nguyên dương'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Giới hạn phải từ 1-50'),
  
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no-show'])
    .withMessage('Trạng thái không hợp lệ'),
  
  handleValidationErrors
];

module.exports = {
  validateUpdateStatus,
  validateGetAllAppointments,
  validateGetAvailableStaff,
  validateGetByDate,
  validateBulkUpdate,
  validateAppointmentId,
  validateCreateAppointment,
  validateUpdateAppointment,
  validateGetAvailableSlots,
  validateGetUserAppointments,
  handleValidationErrors
};