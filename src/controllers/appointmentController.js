// src/controllers/appointmentController.js
const Appointment = require('../models/Appointment');
const CareService = require('../models/CareService');
const Pet = require('../models/Pet');

class AppointmentController {
  // Tạo lịch hẹn mới
  async createAppointment(req, res) {
    try {
      const user_id = req.user.userId;
      const { pet_id, service_id, appointment_date, appointment_time, notes } = req.body;

      // Validation
      if (!pet_id || !service_id || !appointment_date || !appointment_time) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin bắt buộc'
        });
      }

      // Kiểm tra pet thuộc về user
      const pet = await Pet.findOne({ _id: pet_id, user_id });
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thú cưng'
        });
      }

      // Kiểm tra service tồn tại
      const service = await CareService.findById(service_id);
      if (!service || !service.is_active) {
        return res.status(404).json({
          success: false,
          message: 'Dịch vụ không tồn tại hoặc đã ngừng hoạt động'
        });
      }

      // Kiểm tra thời gian đặt lịch hợp lệ (không được trong quá khứ)
      const appointmentDateTime = new Date(`${appointment_date}T${appointment_time}`);
      if (appointmentDateTime <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Thời gian đặt lịch phải trong tương lai'
        });
      }

      // Kiểm tra xem có lịch trùng không (tạm thời bỏ qua staff_id)
      const existingAppointment = await Appointment.findOne({
        appointment_date: new Date(appointment_date),
        appointment_time,
        status: { $nin: ['cancelled'] }
      });

      if (existingAppointment) {
        return res.status(409).json({
          success: false,
          message: 'Khung giờ này đã được đặt'
        });
      }

      // Tạo lịch hẹn
      const appointment = new Appointment({
        user_id,
        pet_id,
        service_id,
        appointment_date: new Date(appointment_date),
        appointment_time,
        notes,
        total_amount: service.price
      });

      await appointment.save();

      // Populate thông tin để trả về
      const populatedAppointment = await Appointment.findById(appointment._id)
        .populate('pet_id', 'name breed_id')
        .populate('service_id', 'name price duration')
        .populate('user_id', 'username email');

      res.status(201).json({
        success: true,
        message: 'Đặt lịch thành công',
        data: populatedAppointment
      });
    } catch (error) {
      console.error('Create appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Lấy danh sách lịch hẹn của user
  async getUserAppointments(req, res) {
    try {
      const user_id = req.user.userId;
      const { status, page = 1, limit = 10 } = req.query;

      // Tạo filter
      const filter = { user_id };
      if (status) {
        filter.status = status;
      }

      // Pagination
      const skip = (page - 1) * limit;
      
      const appointments = await Appointment.find(filter)
        .populate('pet_id', 'name breed_id')
        .populate('service_id', 'name price duration category')
        .populate('staff_id', 'username email')
        .sort({ appointment_date: -1, appointment_time: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Appointment.countDocuments(filter);

      res.status(200).json({
        success: true,
        message: 'Lấy danh sách lịch hẹn thành công',
        data: {
          appointments,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCount: total,
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get user appointments error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Lấy chi tiết lịch hẹn
  async getAppointmentById(req, res) {
    try {
      const user_id = req.user.userId;
      const { id } = req.params;

      const appointment = await Appointment.findOne({ _id: id, user_id })
        .populate('pet_id', 'name breed_id age weight gender')
        .populate('service_id', 'name description price duration category')
        .populate('staff_id', 'username email');

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy lịch hẹn'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Lấy chi tiết lịch hẹn thành công',
        data: appointment
      });
    } catch (error) {
      console.error('Get appointment by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Cập nhật lịch hẹn (chỉ khi chưa confirmed)
  async updateAppointment(req, res) {
    try {
      const user_id = req.user.userId;
      const { id } = req.params;
      const { appointment_date, appointment_time, notes } = req.body;

      const appointment = await Appointment.findOne({ _id: id, user_id });
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy lịch hẹn'
        });
      }

      // Chỉ cho phép cập nhật khi status là pending
      if (appointment.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Không thể cập nhật lịch hẹn đã được xác nhận'
        });
      }

      // Cập nhật thông tin
      if (appointment_date) {
        appointment.appointment_date = new Date(appointment_date);
      }
      if (appointment_time) {
        appointment.appointment_time = appointment_time;
      }
      if (notes !== undefined) {
        appointment.notes = notes;
      }

      await appointment.save();

      const updatedAppointment = await Appointment.findById(appointment._id)
        .populate('pet_id', 'name breed_id')
        .populate('service_id', 'name price duration');

      res.status(200).json({
        success: true,
        message: 'Cập nhật lịch hẹn thành công',
        data: updatedAppointment
      });
    } catch (error) {
      console.error('Update appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Hủy lịch hẹn
  async cancelAppointment(req, res) {
    try {
      const user_id = req.user.userId;
      const { id } = req.params;

      const appointment = await Appointment.findOne({ _id: id, user_id });
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy lịch hẹn'
        });
      }

      // Chỉ cho phép hủy khi status là pending hoặc confirmed
      if (!['pending', 'confirmed'].includes(appointment.status)) {
        return res.status(400).json({
          success: false,
          message: 'Không thể hủy lịch hẹn này'
        });
      }

      appointment.status = 'cancelled';
      await appointment.save();

      res.status(200).json({
        success: true,
        message: 'Hủy lịch hẹn thành công',
        data: appointment
      });
    } catch (error) {
      console.error('Cancel appointment error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // ADMIN: Lấy tất cả lịch hẹn
  async getAllAppointments(req, res) {
    try {
      const { status, date, page = 1, limit = 10 } = req.query;

      // Tạo filter
      const filter = {};
      if (status) {
        filter.status = status;
      }
      if (date) {
        filter.appointment_date = new Date(date);
      }

      // Pagination
      const skip = (page - 1) * limit;
      
      const appointments = await Appointment.find(filter)
        .populate('user_id', 'username email')
        .populate('pet_id', 'name breed_id')
        .populate('service_id', 'name price duration')
        .populate('staff_id', 'username email')
        .sort({ appointment_date: 1, appointment_time: 1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Appointment.countDocuments(filter);

      res.status(200).json({
        success: true,
        message: 'Lấy danh sách lịch hẹn thành công',
        data: {
          appointments,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCount: total,
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get all appointments error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // ADMIN: Cập nhật trạng thái lịch hẹn
  async updateAppointmentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, staff_id } = req.body;

      const appointment = await Appointment.findById(id);
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy lịch hẹn'
        });
      }

      // Cập nhật trạng thái
      if (status) {
        appointment.status = status;
      }
      if (staff_id) {
        appointment.staff_id = staff_id;
      }

      await appointment.save();

      const updatedAppointment = await Appointment.findById(appointment._id)
        .populate('user_id', 'username email')
        .populate('pet_id', 'name breed_id')
        .populate('service_id', 'name price duration')
        .populate('staff_id', 'username email');

      res.status(200).json({
        success: true,
        message: 'Cập nhật trạng thái thành công',
        data: updatedAppointment
      });
    } catch (error) {
      console.error('Update appointment status error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Lấy khung giờ trống
  async getAvailableSlots(req, res) {
    try {
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin ngày'
        });
      }

      // Khung giờ mặc định (9:00 - 17:00)
      const workingHours = [];
      for (let hour = 9; hour <= 17; hour++) {
        workingHours.push(`${hour.toString().padStart(2, '0')}:00`);
        if (hour < 17) {
          workingHours.push(`${hour.toString().padStart(2, '0')}:30`);
        }
      }

      // Lấy các lịch hẹn đã đặt trong ngày
      const bookedAppointments = await Appointment.find({
        appointment_date: new Date(date),
        status: { $nin: ['cancelled'] }
      }).select('appointment_time');

      const bookedSlots = bookedAppointments.map(apt => apt.appointment_time);
      const availableSlots = workingHours.filter(time => !bookedSlots.includes(time));

      res.status(200).json({
        success: true,
        message: 'Lấy khung giờ trống thành công',
        data: {
          date,
          availableSlots,
          bookedSlots
        }
      });
    } catch (error) {
      console.error('Get available slots error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }
}

const appointmentController = new AppointmentController();

module.exports = {
  createAppointment: appointmentController.createAppointment.bind(appointmentController),
  getUserAppointments: appointmentController.getUserAppointments.bind(appointmentController),
  getAppointmentById: appointmentController.getAppointmentById.bind(appointmentController),
  updateAppointment: appointmentController.updateAppointment.bind(appointmentController),
  cancelAppointment: appointmentController.cancelAppointment.bind(appointmentController),
  getAllAppointments: appointmentController.getAllAppointments.bind(appointmentController),
  updateAppointmentStatus: appointmentController.updateAppointmentStatus.bind(appointmentController),
  getAvailableSlots: appointmentController.getAvailableSlots.bind(appointmentController)
};