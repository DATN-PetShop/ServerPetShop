// src/middleware/appointmentValidation.js
const validateCreateService = (req, res, next) => {
  const { name, price, duration, category } = req.body;
  
  const errors = [];
  
  if (!name || name.trim() === '') {
    errors.push({ field: 'name', message: 'Tên dịch vụ là bắt buộc' });
  }
  
  if (!price && price !== 0) {
    errors.push({ field: 'price', message: 'Giá dịch vụ là bắt buộc' });
  } else if (isNaN(price) || price < 0) {
    errors.push({ field: 'price', message: 'Giá phải là số không âm' });
  }
  
  if (!duration) {
    errors.push({ field: 'duration', message: 'Thời gian thực hiện là bắt buộc' });
  } else if (isNaN(duration) || duration < 15) {
    errors.push({ field: 'duration', message: 'Thời gian thực hiện tối thiểu 15 phút' });
  }
  
  if (!category) {
    errors.push({ field: 'category', message: 'Danh mục là bắt buộc' });
  } else if (!['grooming', 'health', 'bathing', 'spa', 'other'].includes(category)) {
    errors.push({ field: 'category', message: 'Danh mục không hợp lệ' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors
    });
  }
  
  next();
};

const validateCreateAppointment = (req, res, next) => {
  const { pet_id, service_id, appointment_date, appointment_time } = req.body;
  
  const errors = [];
  
  if (!pet_id) {
    errors.push({ field: 'pet_id', message: 'Pet ID là bắt buộc' });
  }
  
  if (!service_id) {
    errors.push({ field: 'service_id', message: 'Service ID là bắt buộc' });
  }
  
  if (!appointment_date) {
    errors.push({ field: 'appointment_date', message: 'Ngày hẹn là bắt buộc' });
  }
  
  if (!appointment_time) {
    errors.push({ field: 'appointment_time', message: 'Giờ hẹn là bắt buộc' });
  } else if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(appointment_time)) {
    errors.push({ field: 'appointment_time', message: 'Định dạng giờ không hợp lệ (HH:MM)' });
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors
    });
  }
  
  next();
};

module.exports = {
  validateCreateService,
  validateCreateAppointment
};