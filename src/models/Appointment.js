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
    required: true
  },
  payment_method: {
    type: String,
    enum: ['cod', 'vnpay'],
    required: true
  },
  vnpay_transaction_id: {
    type: String,
    required: false
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
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Thời gian phải theo định dạng HH:MM'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no-show'],
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

// Chỉ mục duy nhất chỉ dựa trên appointment_date và appointment_time
appointmentSchema.index(
  { appointment_date: 1, appointment_time: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $nin: ['cancelled', 'no-show'] }
    }
  }
);

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

appointmentSchema.index({ user_id: 1, status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);