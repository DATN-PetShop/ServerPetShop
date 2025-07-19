// src/models/Appointment.js
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pet_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pet',
    required: true
  },
  service_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CareService',
    required: true
  },
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true // Bắt buộc vì lịch hẹn phải liên kết với đơn hàng
  },
  appointment_date: {
    type: Date,
    required: true
  },
  appointment_time: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Validate time format HH:MM
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Thời gian phải theo định dạng HH:MM'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  staff_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  total_amount: {
    type: Number,
    required: true,
    min: 0
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Index để tránh đặt lịch trùng giờ
appointmentSchema.index({ 
  appointment_date: 1, 
  appointment_time: 1, 
  staff_id: 1 
}, { 
  unique: true, 
  sparse: true 
});

// Middleware để cập nhật updated_at
appointmentSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

// Virtual để tính toán thời gian kết thúc
appointmentSchema.virtual('end_time').get(function() {
  if (this.appointment_time && this.populated('service_id')) {
    const [hours, minutes] = this.appointment_time.split(':');
    const startTime = new Date();
    startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    const endTime = new Date(startTime.getTime() + (this.service_id.duration * 60000));
    return endTime.toTimeString().substring(0, 5);
  }
  return null;
});

module.exports = mongoose.model('Appointment', appointmentSchema);