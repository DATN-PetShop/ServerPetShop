// src/controllers/appointmentController.js
const Appointment = require('../models/Appointment');
const CareService = require('../models/CareService');
const Pet = require('../models/Pet');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');

class AppointmentController {
  // Tạo lịch hẹn mới
  async createAppointment(req, res) {
    try {
      const user_id = req.user?.userId;
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Không xác thực được người dùng'
        });
      }
      const { pet_id, service_id, appointment_date, appointment_time, notes, order_id, total_amount } = req.body;

      // Log request body và user_id
      console.log('createAppointment - Request body:', { pet_id, service_id, appointment_date, appointment_time, notes, order_id, total_amount });
      console.log('createAppointment - Authenticated user_id:', user_id);

      // Validation
    //   if (!pet_id || !service_id || !appointment_date || !appointment_time || !order_id || !total_amount) {
    //     console.log('createAppointment - Validation failed: Missing required fields');
    //     return res.status(400).json({
    //       success: false,
    //       message: 'Thiếu thông tin bắt buộc: pet_id, service_id, appointment_date, appointment_time, order_id, total_amount'
    //     });
    //   }

      // Kiểm tra định dạng appointment_time
      if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(appointment_time)) {
        console.log('createAppointment - Invalid time format:', appointment_time);
        return res.status(400).json({
          success: false,
          message: 'Thời gian phải theo định dạng HH:MM'
        });
      }

      // Kiểm tra đơn hàng thuộc về user
      console.log('createAppointment - Checking order:', { order_id, user_id });
      const order = await Order.findOne({ _id: order_id, user_id });
      if (!order) {
        console.log('createAppointment - Order not found or does not belong to user:', { order_id, user_id });
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy đơn hàng hoặc đơn hàng không thuộc về bạn'
        });
      }
      console.log('createAppointment - Order found:', order);

      // Kiểm tra pet_id trong OrderItem của đơn hàng
      console.log('createAppointment - Checking order item:', { order_id, pet_id });
      const orderItem = await OrderItem.findOne({ order_id, pet_id });
      if (!orderItem) {
        console.log('createAppointment - OrderItem not found:', { order_id, pet_id });
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thú cưng trong đơn hàng đã mua'
        });
      }
      console.log('createAppointment - OrderItem found:', orderItem);

      // Kiểm tra pet tồn tại
      console.log('createAppointment - Checking pet:', pet_id);
      const pet = await Pet.findById(pet_id);
      if (!pet) {
        console.log('createAppointment - Pet not found:', pet_id);
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thú cưng'
        });
      }
      console.log('createAppointment - Pet found:', pet);

      // Kiểm tra service tồn tại
      console.log('createAppointment - Checking service:', service_id);
      const service = await CareService.findById(service_id);
      if (!service || !service.is_active) {
        console.log('createAppointment - Service not found or inactive:', { service_id, is_active: service?.is_active });
        return res.status(404).json({
          success: false,
          message: 'Dịch vụ không tồn tại hoặc đã ngừng hoạt động'
        });
      }
      console.log('createAppointment - Service found:', service);

      // Kiểm tra total_amount khớp với giá dịch vụ
      if (total_amount !== service.price) {
        console.log('createAppointment - Total amount mismatch:', { total_amount, service_price: service.price });
        return res.status(400).json({
          success: false,
          message: 'Số tiền không khớp với giá dịch vụ'
        });
      }

      // Kiểm tra thời gian đặt lịch hợp lệ (không được trong quá khứ)
      const appointmentDateTime = new Date(`${appointment_date}T${appointment_time}:00`);
      console.log('createAppointment - Checking appointment time:', { appointmentDateTime, now: new Date() });
      if (appointmentDateTime <= new Date()) {
        console.log('createAppointment - Appointment time is in the past');
        return res.status(400).json({
          success: false,
          message: 'Thời gian đặt lịch phải trong tương lai'
        });
      }

      // Kiểm tra xem có lịch trùng không
      console.log('createAppointment - Checking for conflicting appointments:', { appointment_date, appointment_time });
      const existingAppointment = await Appointment.findOne({
        appointment_date: new Date(appointment_date),
        appointment_time,
        status: { $nin: ['cancelled'] }
      });
      if (existingAppointment) {
        console.log('createAppointment - Conflicting appointment found:', existingAppointment);
        return res.status(409).json({
          success: false,
          message: 'Khung giờ này đã được đặt'
        });
      }

      // Tạo lịch hẹn
      console.log('createAppointment - Creating new appointment');
      const appointment = new Appointment({
        user_id,
        pet_id,
        service_id,
        order_id, // Thêm dòng này
        appointment_date: new Date(appointment_date),
        appointment_time,
        notes,
        total_amount: service.price
      });

      await appointment.save();
      console.log('createAppointment - Appointment saved:', appointment._id);

      // Populate thông tin để trả về
      const populatedAppointment = await Appointment.findById(appointment._id)
        .populate('pet_id', 'name breed_id')
        .populate('service_id', 'name price duration')
        .populate('user_id', 'username email');
      console.log('createAppointment - Populated appointment:', populatedAppointment);

      res.status(201).json({
        success: true,
        message: 'Đặt lịch thành công',
        data: populatedAppointment
      });
    } catch (error) {
      console.error('createAppointment - Error:', error.message, error.stack);
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
      const user_id = req.user?.userId;
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Không xác thực được người dùng'
        });
      }
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
      const user_id = req.user?.userId;
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Không xác thực được người dùng'
        });
      }
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
      const user_id = req.user?.userId;
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Không xác thực được người dùng'
        });
      }
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
      const user_id = req.user?.userId;
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Không xác thực được người dùng'
        });
      }
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