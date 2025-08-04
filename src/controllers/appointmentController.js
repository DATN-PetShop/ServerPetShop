// src/controllers/appointmentController.js - CẬP NHẬT HỖ TRỢ VARIANT với FALLBACK và POPULATE IMAGES
const Appointment = require('../models/Appointment');
const CareService = require('../models/CareService');
const Pet = require('../models/Pet');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Image = require('../models/ImagePet'); // ✅ THÊM IMPORT CHO IMAGES

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
      const { pet_id, service_id, appointment_date, appointment_time, notes, order_id, total_amount, variant_id, item_type } = req.body;

      // Log request body và user_id
      console.log('createAppointment - Request body:', { pet_id, service_id, appointment_date, appointment_time, notes, order_id, total_amount, variant_id, item_type });
      console.log('createAppointment - Authenticated user_id:', user_id);

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

      // 🔧 CẬP NHẬT: Kiểm tra OrderItem - hỗ trợ cả pet_id và variant_id với FALLBACK
      console.log('createAppointment - Checking order item:', { order_id, pet_id, variant_id, item_type });
      
      let orderItem = null;
      let validatedPetId = pet_id;

      // 🆕 STRATEGY 1: Nếu có variant_id, tìm theo variant_id
      if (variant_id && item_type === 'variant') {
        console.log('createAppointment - Looking for variant order item:', { order_id, variant_id });
        
        orderItem = await OrderItem.findOne({ 
          order_id: order_id,
          variant_id: variant_id 
        }).populate({
          path: 'variant_id',
          populate: {
            path: 'pet_id',
            select: '_id name type breed_id age'
          }
        });

        if (orderItem) {
          console.log('createAppointment - Variant OrderItem found:', orderItem);
          
          // Validate pet_id từ variant
          if (orderItem.variant_id && orderItem.variant_id.pet_id) {
            const variantPetId = orderItem.variant_id.pet_id._id.toString();
            console.log('createAppointment - Variant pet_id:', variantPetId, 'Requested pet_id:', pet_id);
            
            if (variantPetId !== pet_id) {
              console.log('createAppointment - Pet ID mismatch with variant');
              return res.status(400).json({
                success: false,
                message: 'Pet ID không khớp với variant trong đơn hàng'
              });
            }
            validatedPetId = variantPetId;
          } else {
            console.log('createAppointment - Variant found but no pet_id in variant');
            return res.status(400).json({
              success: false,
              message: 'Variant không có thông tin pet hợp lệ'
            });
          }
        }
      }

      // 🆕 STRATEGY 2: Nếu chưa tìm thấy, tìm theo pet_id trực tiếp
      if (!orderItem) {
        console.log('createAppointment - Looking for direct pet order item:', { order_id, pet_id });
        orderItem = await OrderItem.findOne({ 
          order_id: order_id,
          pet_id: pet_id 
        });
      }

      // 🆕 STRATEGY 3: FALLBACK - Tìm variant có pet_id này trong order
      if (!orderItem) {
        console.log('createAppointment - Fallback: Looking for any variant with this pet_id in order:', { order_id, pet_id });
        
        // Tìm tất cả OrderItems có variant_id trong order này
        const variantOrderItems = await OrderItem.find({ 
          order_id: order_id,
          variant_id: { $exists: true, $ne: null }
        }).populate({
          path: 'variant_id',
          populate: {
            path: 'pet_id',
            select: '_id name type breed_id age'
          }
        });

        console.log('createAppointment - Found variant order items:', variantOrderItems.length);

        // Tìm variant có pet_id khớp
        for (const item of variantOrderItems) {
          if (item.variant_id && item.variant_id.pet_id && 
              item.variant_id.pet_id._id.toString() === pet_id) {
            console.log('createAppointment - Found matching variant item:', item._id);
            orderItem = item;
            validatedPetId = pet_id;
            break;
          }
        }
      }

      if (!orderItem) {
        console.log('createAppointment - OrderItem not found after all strategies:', { order_id, pet_id, variant_id });
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thú cưng trong đơn hàng đã mua. Vui lòng kiểm tra lại thông tin đơn hàng.'
        });
      }
      console.log('createAppointment - OrderItem found:', orderItem._id);

      // Kiểm tra pet tồn tại
      console.log('createAppointment - Checking pet:', validatedPetId);
      const pet = await Pet.findById(validatedPetId);
      if (!pet) {
        console.log('createAppointment - Pet not found:', validatedPetId);
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thú cưng'
        });
      }
      console.log('createAppointment - Pet found:', pet.name);

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
      console.log('createAppointment - Service found:', service.name);

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
        console.log('createAppointment - Conflicting appointment found:', existingAppointment._id);
        return res.status(409).json({
          success: false,
          message: 'Khung giờ này đã được đặt'
        });
      }

      // Tạo lịch hẹn
      console.log('createAppointment - Creating new appointment');
      const appointment = new Appointment({
        user_id,
        pet_id: validatedPetId, // Sử dụng validated pet_id
        service_id,
        order_id,
        appointment_date: new Date(appointment_date),
        appointment_time,
        notes,
        total_amount: service.price
      });

      await appointment.save();
      console.log('createAppointment - Appointment saved:', appointment._id);

      // Populate thông tin để trả về (bao gồm images)
      const populatedAppointment = await Appointment.findById(appointment._id)
        .populate('pet_id', 'name breed_id type age weight gender')
        .populate('service_id', 'name price duration')
        .populate('user_id', 'username email')
        .lean();

      // ✅ POPULATE IMAGES CHO PET
      if (populatedAppointment.pet_id && populatedAppointment.pet_id._id) {
        const petImages = await Image.find({ 
          pet_id: populatedAppointment.pet_id._id 
        }).lean();
        populatedAppointment.pet_id.images = petImages;
        console.log(`✅ Populated ${petImages.length} images for created appointment`);
      }

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

  // ✅ UPDATED: Lấy danh sách lịch hẹn của user với IMAGES
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
        .populate('pet_id', 'name breed_id type age weight gender')
        .populate('service_id', 'name price duration category')
        .populate('staff_id', 'username email')
        .populate('user_id', 'username email')
        .populate('order_id', 'total_amount order_date status')
        .sort({ appointment_date: -1, appointment_time: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(); // ✅ Sử dụng .lean() để có thể modify object

      // ✅ POPULATE IMAGES CHO MỖI PET
      if (appointments && appointments.length > 0) {
        for (let appointment of appointments) {
          if (appointment.pet_id && appointment.pet_id._id) {
            // Populate pet images
            const petImages = await Image.find({ 
              pet_id: appointment.pet_id._id 
            }).lean();
            
            appointment.pet_id.images = petImages;
            
            console.log(`✅ Populated ${petImages.length} images for pet ${appointment.pet_id._id} in appointment ${appointment._id}`);
          }
        }
      }

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

  // ✅ UPDATED: Lấy chi tiết lịch hẹn với IMAGES
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
        .populate('pet_id', 'name breed_id age weight gender type')
        .populate('service_id', 'name description price duration category')
        .populate('staff_id', 'username email')
        .lean(); // ✅ Sử dụng .lean() để có thể modify object

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy lịch hẹn'
        });
      }

      // ✅ POPULATE IMAGES CHO PET
      if (appointment.pet_id && appointment.pet_id._id) {
        const petImages = await Image.find({ 
          pet_id: appointment.pet_id._id 
        }).lean();
        
        appointment.pet_id.images = petImages;
        
        console.log(`✅ Populated ${petImages.length} images for pet ${appointment.pet_id._id} in appointment detail`);
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
        .populate('pet_id', 'name breed_id type age weight gender')
        .populate('service_id', 'name price duration')
        .lean();

      // ✅ POPULATE IMAGES CHO PET TRONG UPDATE
      if (updatedAppointment.pet_id && updatedAppointment.pet_id._id) {
        const petImages = await Image.find({ 
          pet_id: updatedAppointment.pet_id._id 
        }).lean();
        updatedAppointment.pet_id.images = petImages;
      }

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

      // Khung giờ mặc định (8:00 - 17:00)
      const workingHours = [
        '08:00', '09:00', '10:00', '11:00', 
        '14:00', '15:00', '16:00', '17:00'
      ];

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
        data: availableSlots
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

      console.log('🔍 Cancelling appointment:', { id, user_id });

      // Tìm lịch hẹn và populate thông tin cần thiết để log
      const appointment = await Appointment.findOne({ _id: id, user_id })
        .populate('pet_id', 'name')
        .populate('service_id', 'name');
        
      if (!appointment) {
        console.log('❌ Appointment not found:', { id, user_id });
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy lịch hẹn hoặc lịch hẹn không thuộc về bạn'
        });
      }

      console.log('📋 Current appointment details:', {
        id: appointment._id,
        status: appointment.status,
        pet: appointment.pet_id?.name,
        service: appointment.service_id?.name,
        date: appointment.appointment_date,
        time: appointment.appointment_time
      });

      // ❌ CHÍNH SÁCH HỦY LỊCH: Chỉ cho phép hủy khi status là 'pending'
      if (appointment.status !== 'pending') {
        console.log('❌ Cannot cancel appointment with status:', appointment.status);
        return res.status(400).json({
          success: false,
          message: getStatusCancelMessage(appointment.status),
          data: {
            currentStatus: appointment.status,
            statusText: getStatusText(appointment.status),
            canCancel: false
          }
        });
      }

      // ⏰ Kiểm tra thời gian: Không được hủy lịch hẹn trong quá khứ
      const appointmentDateTime = new Date(`${appointment.appointment_date.toISOString().split('T')[0]}T${appointment.appointment_time}`);
      const now = new Date();
      
      if (appointmentDateTime <= now) {
        console.log('❌ Cannot cancel past appointment:', { appointmentDateTime, now });
        return res.status(400).json({
          success: false,
          message: 'Không thể hủy lịch hẹn đã qua thời gian đặt lịch'
        });
      }

      // ⏰ TÙYI CHỌN: Kiểm tra thời gian hủy trước (ví dụ: phải hủy trước 2 giờ)
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      if (appointmentDateTime <= twoHoursFromNow) {
        console.log('⚠️ Late cancellation warning:', { appointmentDateTime, twoHoursFromNow });
        // Có thể thêm cảnh báo nhưng vẫn cho phép hủy
        // hoặc có thể từ chối hủy tùy theo chính sách
        console.log('⚠️ Allowing late cancellation (less than 2 hours notice)');
      }

      // ✅ Thực hiện hủy lịch hẹn
      const oldStatus = appointment.status;
      appointment.status = 'cancelled';
      appointment.updated_at = new Date();
      
      await appointment.save();

      console.log('✅ Appointment cancelled successfully:', {
        id: appointment._id,
        oldStatus,
        newStatus: appointment.status,
        pet: appointment.pet_id?.name,
        service: appointment.service_id?.name
      });

      // Populate thông tin đầy đủ để trả về client
      const cancelledAppointment = await Appointment.findById(appointment._id)
        .populate('pet_id', 'name breed_id images')
        .populate('service_id', 'name price duration description')
        .populate('user_id', 'username email')
        .populate('order_id', 'total_amount order_date status');

      res.status(200).json({
        success: true,
        message: 'Hủy lịch hẹn thành công',
        data: cancelledAppointment
      });

    } catch (error) {
      console.error('❌ Cancel appointment error:', {
        message: error.message,
        stack: error.stack,
        appointmentId: req.params.id,
        userId: req.user?.userId
      });

      res.status(500).json({
        success: false,
        message: 'Lỗi server khi hủy lịch hẹn',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}
const getStatusCancelMessage = (status) => {
  switch (status) {
    case 'confirmed':
      return 'Không thể hủy lịch hẹn đã được xác nhận. Vui lòng liên hệ với phòng khám để được hỗ trợ.';
    case 'in_progress':
      return 'Không thể hủy lịch hẹn đang được thực hiện.';
    case 'completed':
      return 'Không thể hủy lịch hẹn đã hoàn thành.';
    case 'cancelled':
      return 'Lịch hẹn đã được hủy trước đó.';
    default:
      return 'Không thể hủy lịch hẹn ở trạng thái hiện tại.';
  }
};

// Helper function để chuyển đổi status thành text
const getStatusText = (status) => {
  switch (status) {
    case 'pending':
      return 'Chờ xác nhận';
    case 'confirmed':
      return 'Đã xác nhận';
    case 'in_progress':
      return 'Đang thực hiện';
    case 'completed':
      return 'Hoàn thành';
    case 'cancelled':
      return 'Đã hủy';
    default:
      return status;
  }
};
const appointmentController = new AppointmentController();

module.exports = {
  createAppointment: appointmentController.createAppointment.bind(appointmentController),
  getUserAppointments: appointmentController.getUserAppointments.bind(appointmentController),
  getAppointmentById: appointmentController.getAppointmentById.bind(appointmentController),
  updateAppointment: appointmentController.updateAppointment.bind(appointmentController),
  cancelAppointment: appointmentController.cancelAppointment.bind(appointmentController),
  getAvailableSlots: appointmentController.getAvailableSlots.bind(appointmentController)
};