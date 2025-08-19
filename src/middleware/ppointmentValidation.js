// src/middleware/appointmentValidation.js
const mongoose = require('mongoose');

const validateCreateService = (req, res, next) => {
  const { name, price, duration, category, description } = req.body;
  
  const errors = [];
  
  // Validate name
  if (!name || name.trim() === '') {
    errors.push({ field: 'name', message: 'Tên dịch vụ là bắt buộc' });
  } else if (name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Tên dịch vụ phải có ít nhất 2 ký tự' });
  } else if (name.trim().length > 100) {
    errors.push({ field: 'name', message: 'Tên dịch vụ không được vượt quá 100 ký tự' });
  }
  
  // Validate price
  if (price === undefined || price === null) {
    errors.push({ field: 'price', message: 'Giá dịch vụ là bắt buộc' });
  } else if (isNaN(price) || price < 0) {
    errors.push({ field: 'price', message: 'Giá phải là số không âm' });
  } else if (price > 50000000) {
    errors.push({ field: 'price', message: 'Giá dịch vụ không được vượt quá 50,000,000 VNĐ' });
  }
  
  // Validate duration
  if (!duration) {
    errors.push({ field: 'duration', message: 'Thời gian thực hiện là bắt buộc' });
  } else if (isNaN(duration) || duration < 15) {
    errors.push({ field: 'duration', message: 'Thời gian thực hiện tối thiểu 15 phút' });
  } else if (duration > 480) {
    errors.push({ field: 'duration', message: 'Thời gian thực hiện tối đa 8 giờ (480 phút)' });
  }
  
  // Validate category
  const validCategories = ['grooming', 'health', 'bathing', 'spa', 'training', 'other'];
  if (!category) {
    errors.push({ field: 'category', message: 'Danh mục là bắt buộc' });
  } else if (!validCategories.includes(category)) {
    errors.push({ 
      field: 'category', 
      message: `Danh mục không hợp lệ. Chỉ chấp nhận: ${validCategories.join(', ')}` 
    });
  }

  // Validate description (optional)
  if (description && description.length > 500) {
    errors.push({ field: 'description', message: 'Mô tả không được vượt quá 500 ký tự' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Dữ liệu không hợp lệ',
      errors: errors
    });
  }
  
  next();
};

const validateCreateAppointment = (req, res, next) => {
  const { 
    pet_id, 
    service_id, 
    appointment_date, 
    appointment_time,
    customer_name,
    customer_phone,
    notes
  } = req.body;
  
  const errors = [];
  
  // Validate pet_id
  if (!pet_id) {
    errors.push({ field: 'pet_id', message: 'Pet ID là bắt buộc' });
  } else if (!mongoose.Types.ObjectId.isValid(pet_id)) {
    errors.push({ field: 'pet_id', message: 'Pet ID không hợp lệ' });
  }
  
  // Validate service_id
  if (!service_id) {
    errors.push({ field: 'service_id', message: 'Service ID là bắt buộc' });
  } else if (!mongoose.Types.ObjectId.isValid(service_id)) {
    errors.push({ field: 'service_id', message: 'Service ID không hợp lệ' });
  }
  
  // Validate appointment_date
  if (!appointment_date) {
    errors.push({ field: 'appointment_date', message: 'Ngày hẹn là bắt buộc' });
  } else {
    const appointmentDate = new Date(appointment_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(appointmentDate.getTime())) {
      errors.push({ field: 'appointment_date', message: 'Định dạng ngày không hợp lệ' });
    } else if (appointmentDate < today) {
      errors.push({ field: 'appointment_date', message: 'Ngày hẹn không được là ngày trong quá khứ' });
    }
    
    // Check if appointment is within next 3 months
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    if (appointmentDate > maxDate) {
      errors.push({ field: 'appointment_date', message: 'Ngày hẹn không được quá 3 tháng từ hôm nay' });
    }
  }
  
  // Validate appointment_time
  if (!appointment_time) {
    errors.push({ field: 'appointment_time', message: 'Giờ hẹn là bắt buộc' });
  } else if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(appointment_time)) {
    errors.push({ field: 'appointment_time', message: 'Định dạng giờ không hợp lệ (HH:MM)' });
  } else {
    // Check business hours (8:00 - 18:00)
    const [hours, minutes] = appointment_time.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;
    const startTime = 8 * 60; // 8:00 AM
    const endTime = 18 * 60;  // 6:00 PM
    
    if (timeInMinutes < startTime || timeInMinutes >= endTime) {
      errors.push({ 
        field: 'appointment_time', 
        message: 'Giờ hẹn phải trong khoảng 08:00 - 18:00' 
      });
    }
  }

  // Validate customer_name (optional but recommended)
  if (customer_name && customer_name.trim().length < 2) {
    errors.push({ field: 'customer_name', message: 'Tên khách hàng phải có ít nhất 2 ký tự' });
  } else if (customer_name && customer_name.trim().length > 50) {
    errors.push({ field: 'customer_name', message: 'Tên khách hàng không được vượt quá 50 ký tự' });
  }

  // Validate customer_phone (optional but recommended)
  if (customer_phone && !/^[0-9+\-\s()]{10,15}$/.test(customer_phone)) {
    errors.push({ 
      field: 'customer_phone', 
      message: 'Số điện thoại không hợp lệ (10-15 số)' 
    });
  }

  // Validate notes (optional)
  if (notes && notes.length > 300) {
    errors.push({ field: 'notes', message: 'Ghi chú không được vượt quá 300 ký tự' });
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Dữ liệu không hợp lệ',
      errors: errors
    });
  }
  
  next();
};

const validateUpdateAppointment = (req, res, next) => {
  const { 
    status,
    appointment_date, 
    appointment_time,
    customer_name,
    customer_phone,
    notes,
    admin_notes
  } = req.body;
  
  const errors = [];
  
  // Validate status if provided
  if (status) {
    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      errors.push({ 
        field: 'status', 
        message: `Trạng thái không hợp lệ. Chỉ chấp nhận: ${validStatuses.join(', ')}` 
      });
    }
  }
  
  // Validate appointment_date if provided
  if (appointment_date) {
    const appointmentDate = new Date(appointment_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(appointmentDate.getTime())) {
      errors.push({ field: 'appointment_date', message: 'Định dạng ngày không hợp lệ' });
    } else if (appointmentDate < today) {
      errors.push({ field: 'appointment_date', message: 'Ngày hẹn không được là ngày trong quá khứ' });
    }
  }
  
  // Validate appointment_time if provided
  if (appointment_time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(appointment_time)) {
    errors.push({ field: 'appointment_time', message: 'Định dạng giờ không hợp lệ (HH:MM)' });
  }

  // Validate customer_name if provided
  if (customer_name && customer_name.trim().length < 2) {
    errors.push({ field: 'customer_name', message: 'Tên khách hàng phải có ít nhất 2 ký tự' });
  }

  // Validate customer_phone if provided
  if (customer_phone && !/^[0-9+\-\s()]{10,15}$/.test(customer_phone)) {
    errors.push({ field: 'customer_phone', message: 'Số điện thoại không hợp lệ' });
  }

  // Validate notes if provided
  if (notes && notes.length > 300) {
    errors.push({ field: 'notes', message: 'Ghi chú không được vượt quá 300 ký tự' });
  }

  // Validate admin_notes if provided
  if (admin_notes && admin_notes.length > 500) {
    errors.push({ field: 'admin_notes', message: 'Ghi chú admin không được vượt quá 500 ký tự' });
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Dữ liệu không hợp lệ',
      errors: errors
    });
  }
  
  next();
};

const validateUpdateService = (req, res, next) => {
  const { name, price, duration, category, description, is_active } = req.body;
  
  const errors = [];
  
  // Validate name if provided
  if (name !== undefined) {
    if (!name || name.trim() === '') {
      errors.push({ field: 'name', message: 'Tên dịch vụ không được để trống' });
    } else if (name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Tên dịch vụ phải có ít nhất 2 ký tự' });
    } else if (name.trim().length > 100) {
      errors.push({ field: 'name', message: 'Tên dịch vụ không được vượt quá 100 ký tự' });
    }
  }
  
  // Validate price if provided
  if (price !== undefined) {
    if (isNaN(price) || price < 0) {
      errors.push({ field: 'price', message: 'Giá phải là số không âm' });
    } else if (price > 50000000) {
      errors.push({ field: 'price', message: 'Giá dịch vụ không được vượt quá 50,000,000 VNĐ' });
    }
  }
  
  // Validate duration if provided
  if (duration !== undefined) {
    if (isNaN(duration) || duration < 15) {
      errors.push({ field: 'duration', message: 'Thời gian thực hiện tối thiểu 15 phút' });
    } else if (duration > 480) {
      errors.push({ field: 'duration', message: 'Thời gian thực hiện tối đa 8 giờ (480 phút)' });
    }
  }
  
  // Validate category if provided
  if (category !== undefined) {
    const validCategories = ['grooming', 'health', 'bathing', 'spa', 'training', 'other'];
    if (!validCategories.includes(category)) {
      errors.push({ 
        field: 'category', 
        message: `Danh mục không hợp lệ. Chỉ chấp nhận: ${validCategories.join(', ')}` 
      });
    }
  }

  // Validate description if provided
  if (description !== undefined && description.length > 500) {
    errors.push({ field: 'description', message: 'Mô tả không được vượt quá 500 ký tự' });
  }

  // Validate is_active if provided
  if (is_active !== undefined && typeof is_active !== 'boolean') {
    errors.push({ field: 'is_active', message: 'Trạng thái hoạt động phải là true hoặc false' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Dữ liệu không hợp lệ',
      errors: errors
    });
  }
  
  next();
};

module.exports = {
  validateCreateService,
  validateCreateAppointment,
  validateUpdateAppointment,
  validateUpdateService
};