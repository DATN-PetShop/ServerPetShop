const Appointment = require('../models/Appointment');
const CareService = require('../models/CareService');
const Pet = require('../models/Pet');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Image = require('../models/ImagePet');
const { sendAppointmentNotification } = require('../services/notificationService');

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

      // Thêm: Kiểm tra số lần no-show trong 3 tháng gần nhất
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90); // 3 tháng = 90 ngày
      const noShowCount = await Appointment.countDocuments({
        user_id,
        status: 'no-show',
        appointment_date: { $gte: threeMonthsAgo }
      });

      console.log('createAppointment - No-show count for user (last 3 months):', { user_id, noShowCount });

      if (noShowCount >= 3) {
        if (req.body.payment_method !== 'vnpay') {
          console.log('createAppointment - Blocked: User has >=3 no-shows in last 3 months, must use vnpay');
          return res.status(403).json({
            success: false,
            message: 'Bạn đã không đến lịch hẹn 3 lần trong 3 tháng qua. Để đặt lịch mới, vui lòng sử dụng thanh toán VNPay.'
          });
        }
        // Nếu dùng vnpay, tiếp tục bình thường
      }

      const { pet_id, service_id, appointment_date, appointment_time, notes, order_id, total_amount, variant_id, item_type, payment_method, vnpay_transaction_id } = req.body;

      // Log request body và user_id
      console.log('createAppointment - Request body:', { pet_id, service_id, appointment_date, appointment_time, notes, order_id, total_amount, variant_id, item_type, payment_method, vnpay_transaction_id });
      console.log('createAppointment - Authenticated user_id:', user_id);

      // Kiểm tra các trường bắt buộc
      if (!pet_id || !service_id || !appointment_date || !appointment_time || !order_id || !total_amount || !payment_method) {
        console.log('createAppointment - Missing required fields:', { pet_id, service_id, appointment_date, appointment_time, order_id, total_amount, payment_method });
        return res.status(400).json({
          success: false,
          message: 'Thiếu các trường bắt buộc (pet_id, service_id, appointment_date, appointment_time, order_id, total_amount, payment_method)'
        });
      }

      // Kiểm tra định dạng payment_method
      if (!['cod', 'vnpay'].includes(payment_method)) {
        console.log('createAppointment - Invalid payment_method:', payment_method);
        return res.status(400).json({
          success: false,
          message: 'Phương thức thanh toán phải là "cod" hoặc "vnpay"'
        });
      }

      // Kiểm tra vnpay_transaction_id nếu payment_method là vnpay
      if (payment_method === 'vnpay' && !vnpay_transaction_id) {
        console.log('createAppointment - Missing vnpay_transaction_id for vnpay payment');
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp vnpay_transaction_id khi chọn phương thức thanh toán vnpay'
        });
      }

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

      // Kiểm tra OrderItem - hỗ trợ cả pet_id và variant_id với FALLBACK
      console.log('createAppointment - Checking order item:', { order_id, pet_id, variant_id, item_type });
      
      let orderItem = null;
      let validatedPetId = pet_id;

      // STRATEGY 1: Nếu có variant_id, tìm theo variant_id
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

      // STRATEGY 2: Nếu chưa tìm thấy, tìm theo pet_id trực tiếp
      if (!orderItem) {
        console.log('createAppointment - Looking for direct pet order item:', { order_id, pet_id });
        orderItem = await OrderItem.findOne({ 
          order_id: order_id,
          pet_id: pet_id 
        });
      }

      // STRATEGY 3: FALLBACK - Tìm variant có pet_id này trong order
      if (!orderItem) {
        console.log('createAppointment - Fallback: Looking for any variant with this pet_id in order:', { order_id, pet_id });
        
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
        pet_id: validatedPetId,
        service_id,
        order_id,
        appointment_date: new Date(appointment_date),
        appointment_time,
        notes,
        total_amount: service.price,
        payment_method,
        vnpay_transaction_id: payment_method === 'vnpay' ? vnpay_transaction_id : null
      });

      await appointment.save();
      console.log('createAppointment - Appointment saved:', appointment._id);

      // Populate thông tin để trả về (bao gồm images)
      const populatedAppointment = await Appointment.findById(appointment._id)
        .populate('pet_id', 'name breed_id type age weight gender')
        .populate('service_id', 'name price duration')
        .populate('user_id', 'username email')
        .lean();

      // POPULATE IMAGES CHO PET
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

      // Thông báo cho chính người dùng về lịch hẹn vừa tạo (trạng thái pending)
      try {
        await sendAppointmentNotification(user_id, appointment._id, 'pending');
      } catch (err) {
        console.error('Failed to notify user about created appointment:', err);
      }

      // Thông báo cho Admin/Staff về lịch hẹn mới
      try {
        const { notifyAdmins } = require('../services/notificationService');
        await notifyAdmins({
          title: '📅 Lịch hẹn mới',
          body: `Khách hàng vừa đặt lịch dịch vụ ${service.name}`,
          type: 'appointment_admin',
          relatedEntityId: appointment._id,
          relatedEntityType: 'Appointment',
          data: { appointmentId: appointment._id }
        });
      } catch (err) {
        console.error('Failed to notify admins about appointment:', err);
      }
    } catch (error) {
      console.error('createAppointment - Error:', error.message, error.stack);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

async getNoShowStatus(req, res) {
  try {
    const user_id = req.user?.userId;
    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Không xác thực được người dùng' });
    }
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
    const noShowCount = await Appointment.countDocuments({
      user_id,
      status: 'no-show',
      appointment_date: { $gte: threeMonthsAgo }
    });
    res.status(200).json({
      success: true,
      data: { noShowCount, restricted: noShowCount >= 3 }
    });
  } catch (error) {
    console.error('Get no-show status error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
}}

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
  getAvailableSlots: appointmentController.getAvailableSlots.bind(appointmentController),
  getNoShowStatus: appointmentController.getNoShowStatus.bind(appointmentController)
};