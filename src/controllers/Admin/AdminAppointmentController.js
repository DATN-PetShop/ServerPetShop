// src/controllers/AdminAppointmentController.js
const Appointment = require('../../models/Appointment');
const CareService = require('../../models/CareService');
const Pet = require('../../models/Pet');
const User = require('../../models/User');
const Order = require('../../models/Order');

class AdminAppointmentController {
  // Lấy tất cả lịch hẹn với nhiều filter options
  async getAllAppointments(req, res) {
    try {
      const { 
        status, 
        date, 
        date_from, 
        date_to,
        staff_id,
        service_id,
        user_id,
        search,
        page = 1, 
        limit = 10,
        sort_by = 'appointment_date',
        sort_order = 'asc'
      } = req.query;

      console.log('Admin getAllAppointments - Query params:', req.query);

      // Tạo filter object
      const filter = {};
      
      // Filter theo status
      if (status) {
        filter.status = status;
      }

      // Filter theo ngày cụ thể
      if (date) {
        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
        filter.appointment_date = { $gte: startOfDay, $lte: endOfDay };
      }

      // Filter theo khoảng thời gian
      if (date_from || date_to) {
        filter.appointment_date = {};
        if (date_from) {
          filter.appointment_date.$gte = new Date(date_from);
        }
        if (date_to) {
          filter.appointment_date.$lte = new Date(date_to);
        }
      }

      // Filter theo staff
      if (staff_id) {
        filter.staff_id = staff_id;
      }

      // Filter theo service
      if (service_id) {
        filter.service_id = service_id;
      }

      // Filter theo user
      if (user_id) {
        filter.user_id = user_id;
      }

      console.log('Admin getAllAppointments - Filter:', filter);

      // Tạo sort object
      const sortObj = {};
      sortObj[sort_by] = sort_order === 'desc' ? -1 : 1;
      
      // Thêm sort phụ để đảm bảo thứ tự nhất quán
      if (sort_by !== 'appointment_date') {
        sortObj.appointment_date = 1;
      }
      if (sort_by !== 'appointment_time') {
        sortObj.appointment_time = 1;
      }

      // Pagination
      const skip = (page - 1) * limit;
      
      // Query appointments với populate đầy đủ
      let appointmentQuery = Appointment.find(filter)
        .populate({
          path: 'user_id', 
          select: 'username email full_name phone'
        })
        .populate({
          path: 'pet_id', 
          select: 'name breed_id age weight gender type',
          populate: {
            path: 'breed_id',
            select: 'name'
          }
        })
        .populate({
          path: 'service_id', 
          select: 'name description price duration category'
        })
        .populate({
          path: 'staff_id', 
          select: 'username email full_name'
        })
        .populate({
          path: 'order_id',
          select: 'order_number total_amount order_date status'
        })
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit));

      // Thực hiện search nếu có
      if (search) {
        // Tìm kiếm theo nhiều trường
        const searchRegex = new RegExp(search, 'i');
        
        // Tìm users theo tên hoặc email
        const users = await User.find({
          $or: [
            { username: searchRegex },
            { email: searchRegex },
            { full_name: searchRegex }
          ]
        }).select('_id');
        const userIds = users.map(u => u._id);

        // Tìm pets theo tên
        const pets = await Pet.find({
          name: searchRegex
        }).select('_id');
        const petIds = pets.map(p => p._id);

        // Tìm services theo tên
        const services = await CareService.find({
          name: searchRegex
        }).select('_id');
        const serviceIds = services.map(s => s._id);

        // Cập nhật filter với search conditions
        filter.$or = [
          { user_id: { $in: userIds } },
          { pet_id: { $in: petIds } },
          { service_id: { $in: serviceIds } },
          { notes: searchRegex }
        ];

        // Tạo lại query với filter mới
        appointmentQuery = Appointment.find(filter)
          .populate({
            path: 'user_id', 
            select: 'username email full_name phone'
          })
          .populate({
            path: 'pet_id', 
            select: 'name breed_id age weight gender type',
            populate: {
              path: 'breed_id',
              select: 'name'
            }
          })
          .populate({
            path: 'service_id', 
            select: 'name description price duration category'
          })
          .populate({
            path: 'staff_id', 
            select: 'username email full_name'
          })
          .populate({
            path: 'order_id',
            select: 'order_number total_amount order_date status'
          })
          .sort(sortObj)
          .skip(skip)
          .limit(parseInt(limit));
      }

      const appointments = await appointmentQuery;
      const total = await Appointment.countDocuments(filter);

      // Thống kê thêm
      const stats = await this.getAppointmentStats(filter);

      console.log('Admin getAllAppointments - Found:', appointments.length, 'Total:', total);

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
            hasPrevPage: page > 1,
            limit: parseInt(limit)
          },
          stats
        }
      });
    } catch (error) {
      console.error('Admin getAllAppointments error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Lấy thống kê lịch hẹn
  async getAppointmentStats(filter = {}) {
    try {
      const stats = await Appointment.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$total_amount' }
          }
        }
      ]);

      const statusStats = {
        pending: { count: 0, totalAmount: 0 },
        confirmed: { count: 0, totalAmount: 0 },
        in_progress: { count: 0, totalAmount: 0 },
        completed: { count: 0, totalAmount: 0 },
        cancelled: { count: 0, totalAmount: 0 }
      };

      stats.forEach(stat => {
        if (statusStats[stat._id]) {
          statusStats[stat._id] = {
            count: stat.count,
            totalAmount: stat.totalAmount
          };
        }
      });

      return statusStats;
    } catch (error) {
      console.error('Get appointment stats error:', error);
      return {};
    }
  }

  // Cập nhật trạng thái lịch hẹn và phân công nhân viên
  async updateAppointmentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, staff_id, notes, admin_notes } = req.body;
      const admin_user_id = req.user?.userId;

      console.log('Admin updateAppointmentStatus:', { id, status, staff_id, admin_user_id });

      // Validate input
      if (!status && !staff_id && !notes && !admin_notes) {
        return res.status(400).json({
          success: false,
          message: 'Cần ít nhất một trường để cập nhật'
        });
      }

      // Kiểm tra appointment tồn tại
      const appointment = await Appointment.findById(id);
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy lịch hẹn'
        });
      }

      // Validate status
      const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Trạng thái không hợp lệ'
        });
      }

      // Validate staff_id nếu có
      if (staff_id) {
        const staff = await User.findOne({ 
          _id: staff_id, 
          role: { $in: ['Staff', 'Admin'] },
          status: 'active' 
        });
        if (!staff) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy nhân viên hoặc nhân viên không hoạt động'
          });
        }
      }

      // Kiểm tra business rules
      if (status) {
        // Không thể chuyển từ completed/cancelled sang trạng thái khác
        if (['completed', 'cancelled'].includes(appointment.status) && 
            appointment.status !== status) {
          return res.status(400).json({
            success: false,
            message: `Không thể thay đổi trạng thái từ ${appointment.status} sang ${status}`
          });
        }

        // Phải có staff_id khi confirmed hoặc in_progress
        if (['confirmed', 'in_progress'].includes(status) && 
            !staff_id && !appointment.staff_id) {
          return res.status(400).json({
            success: false,
            message: 'Cần phân công nhân viên trước khi xác nhận lịch hẹn'
          });
        }
      }

      // Kiểm tra xung đột lịch hẹn khi phân công staff
      if (staff_id && status !== 'cancelled') {
        const conflictAppointment = await Appointment.findOne({
          _id: { $ne: id },
          staff_id: staff_id,
          appointment_date: appointment.appointment_date,
          appointment_time: appointment.appointment_time,
          status: { $nin: ['cancelled'] }
        });

        if (conflictAppointment) {
          return res.status(409).json({
            success: false,
            message: 'Nhân viên đã có lịch hẹn khác trong khung giờ này'
          });
        }
      }

      // Cập nhật appointment
      const updateData = { updated_at: new Date() };
      
      if (status) updateData.status = status;
      if (staff_id) updateData.staff_id = staff_id;
      if (notes !== undefined) updateData.notes = notes;
      if (admin_notes !== undefined) updateData.admin_notes = admin_notes;

      // Lưu log thay đổi
      if (!appointment.change_log) {
        appointment.change_log = [];
      }
      
      const changeLogEntry = {
        timestamp: new Date(),
        admin_id: admin_user_id,
        changes: {}
      };

      if (status && status !== appointment.status) {
        changeLogEntry.changes.status = {
          from: appointment.status,
          to: status
        };
      }

      if (staff_id && staff_id !== appointment.staff_id?.toString()) {
        changeLogEntry.changes.staff_id = {
          from: appointment.staff_id,
          to: staff_id
        };
      }

      if (Object.keys(changeLogEntry.changes).length > 0) {
        updateData.change_log = [...appointment.change_log, changeLogEntry];
      }

      const updatedAppointment = await Appointment.findByIdAndUpdate(
        id, 
        updateData, 
        { new: true }
      )
        .populate({
          path: 'user_id', 
          select: 'username email full_name phone'
        })
        .populate({
          path: 'pet_id', 
          select: 'name breed_id age weight gender type',
          populate: {
            path: 'breed_id',
            select: 'name'
          }
        })
        .populate({
          path: 'service_id', 
          select: 'name description price duration category'
        })
        .populate({
          path: 'staff_id', 
          select: 'username email full_name'
        })
        .populate({
          path: 'order_id',
          select: 'order_number total_amount order_date status'
        });

      console.log('Admin updateAppointmentStatus - Updated successfully:', updatedAppointment._id);

      res.status(200).json({
        success: true,
        message: 'Cập nhật lịch hẹn thành công',
        data: updatedAppointment
      });
    } catch (error) {
      console.error('Admin updateAppointmentStatus error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Lấy chi tiết lịch hẹn (admin view)
  async getAppointmentById(req, res) {
    try {
      const { id } = req.params;

      const appointment = await Appointment.findById(id)
        .populate({
          path: 'user_id', 
          select: 'username email full_name phone created_at'
        })
        .populate({
          path: 'pet_id', 
          select: 'name breed_id age weight gender type description created_at',
          populate: {
            path: 'breed_id',
            select: 'name'
          }
        })
        .populate({
          path: 'service_id', 
          select: 'name description price duration category'
        })
        .populate({
          path: 'staff_id', 
          select: 'username email full_name'
        })
        .populate({
          path: 'order_id',
          select: 'order_number total_amount order_date status payment_method payment_status created_at'
        });

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy lịch hẹn'
        });
      }

      // Lấy thêm thông tin lịch sử lịch hẹn của user
      const userAppointmentHistory = await Appointment.find({
        user_id: appointment.user_id._id,
        _id: { $ne: id }
      })
        .populate('service_id', 'name')
        .populate('pet_id', 'name')
        .sort({ appointment_date: -1 })
        .limit(5);

      res.status(200).json({
        success: true,
        message: 'Lấy chi tiết lịch hẹn thành công',
        data: {
          appointment,
          userAppointmentHistory
        }
      });
    } catch (error) {
      console.error('Admin getAppointmentById error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Lấy danh sách nhân viên có thể phân công
async getAvailableStaff(req, res) {
    try {
        const { appointment_date, appointment_time, service_id } = req.query;

        if (!appointment_date || !appointment_time) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin ngày và giờ hẹn'
            });
        }

        // Lấy tất cả staff active
        const allStaff = await User.find({
            role: { $in: ['Staff', 'Admin'] },
            status: 'active' // Sửa từ is_active: true thành status: 'active'
        }).select('username email full_name');

        // Debug: Log danh sách nhân viên
        console.log('All Staff:', allStaff);

        // Lấy staff đã có lịch hẹn trong khung giờ này
        const busyStaff = await Appointment.find({
            appointment_date: new Date(appointment_date),
            appointment_time: appointment_time,
            status: { $nin: ['cancelled'] },
            staff_id: { $exists: true, $ne: null }
        }).distinct('staff_id');

        // Debug: Log danh sách nhân viên bận
        console.log('Busy Staff IDs:', busyStaff);

        // Filter ra staff available
        const availableStaff = allStaff.filter(staff => 
            !busyStaff.some(busyId => busyId.toString() === staff._id.toString())
        );

        res.status(200).json({
            success: true,
            message: 'Lấy danh sách nhân viên thành công',
            data: {
                availableStaff,
                totalStaff: allStaff.length,
                busyStaffCount: busyStaff.length
            }
        });
    } catch (error) {
        console.error('Get available staff error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
}
async assignStaffToAppointment(req, res) {
    try {
        const { id } = req.params;
        const { staff_id } = req.body;
        const admin_user_id = req.user?.userId;

        console.log('Admin assignStaffToAppointment:', { id, staff_id, admin_user_id });

        // Kiểm tra appointment tồn tại
        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch hẹn'
            });
        }

        // Validate staff_id nếu có
        if (staff_id) {
            const staff = await User.findOne({ 
                _id: staff_id, 
                role: { $in: ['Staff', 'Admin'] },
                status: 'active'
            });
            if (!staff) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy nhân viên hoặc nhân viên không hoạt động'
                });
            }

            // Kiểm tra xung đột lịch hẹn
            const conflictAppointment = await Appointment.findOne({
                _id: { $ne: id },
                staff_id: staff_id,
                appointment_date: appointment.appointment_date,
                appointment_time: appointment.appointment_time,
                status: { $nin: ['cancelled'] }
            });

            if (conflictAppointment) {
                return res.status(409).json({
                    success: false,
                    message: 'Nhân viên đã có lịch hẹn khác trong khung giờ này'
                });
            }
        }

        // Cập nhật appointment
        const updateData = { 
            staff_id: staff_id || null,
            updated_at: new Date() 
        };

        // Lưu log thay đổi
        if (!appointment.change_log) {
            appointment.change_log = [];
        }
        
        const changeLogEntry = {
            timestamp: new Date(),
            admin_id: admin_user_id,
            changes: {
                staff_id: {
                    from: appointment.staff_id,
                    to: staff_id || null
                }
            }
        };

        updateData.change_log = [...appointment.change_log, changeLogEntry];

        const updatedAppointment = await Appointment.findByIdAndUpdate(
            id, 
            updateData, 
            { new: true }
        ).populate([
            { path: 'user_id', select: 'username email full_name phone' },
            { path: 'pet_id', select: 'name breed_id age weight gender type' },
            { path: 'service_id', select: 'name description price duration category' },
            { path: 'staff_id', select: 'username email full_name' },
            { path: 'order_id', select: 'order_number total_amount order_date status' }
        ]);

        res.status(200).json({
            success: true,
            message: staff_id ? 'Phân công nhân viên thành công' : 'Hủy phân công nhân viên thành công',
            data: updatedAppointment
        });
    } catch (error) {
        console.error('Admin assignStaffToAppointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
}

// Thêm method unassignStaffFromAppointment
async unassignStaffFromAppointment(req, res) {
    try {
        const { id } = req.params;
        const admin_user_id = req.user?.userId;

        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch hẹn'
            });
        }

        // Lưu log thay đổi
        const changeLogEntry = {
            timestamp: new Date(),
            admin_id: admin_user_id,
            changes: {
                staff_id: {
                    from: appointment.staff_id,
                    to: null
                }
            }
        };

        const updateData = {
            staff_id: null,
            updated_at: new Date(),
            change_log: [...(appointment.change_log || []), changeLogEntry]
        };

        const updatedAppointment = await Appointment.findByIdAndUpdate(
            id, 
            updateData, 
            { new: true }
        ).populate([
            { path: 'user_id', select: 'username email full_name phone' },
            { path: 'pet_id', select: 'name breed_id age weight gender type' },
            { path: 'service_id', select: 'name description price duration category' },
            { path: 'staff_id', select: 'username email full_name' },
            { path: 'order_id', select: 'order_number total_amount order_date status' }
        ]);

        res.status(200).json({
            success: true,
            message: 'Hủy phân công nhân viên thành công',
            data: updatedAppointment
        });
    } catch (error) {
        console.error('Admin unassignStaffFromAppointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
}

  // Lấy thống kê tổng quan
  async getDashboardStats(req, res) {
    try {
      const { date_from, date_to } = req.query;
      
      // Tạo filter thời gian
      const dateFilter = {};
      if (date_from || date_to) {
        dateFilter.appointment_date = {};
        if (date_from) {
          dateFilter.appointment_date.$gte = new Date(date_from);
        }
        if (date_to) {
          dateFilter.appointment_date.$lte = new Date(date_to);
        }
      }

      // Thống kê theo status
      const statusStats = await this.getAppointmentStats(dateFilter);

      // Thống kê theo service
      const serviceStats = await Appointment.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$service_id',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$total_amount' }
          }
        },
        {
          $lookup: {
            from: 'careservices',
            localField: '_id',
            foreignField: '_id',
            as: 'service'
          }
        },
        {
          $unwind: '$service'
        },
        {
          $project: {
            serviceName: '$service.name',
            count: 1,
            totalRevenue: 1
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      // Thống kê theo staff
      const staffStats = await Appointment.aggregate([
        { 
          $match: { 
            ...dateFilter,
            staff_id: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$staff_id',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$total_amount' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'staff'
          }
        },
        {
          $unwind: '$staff'
        },
        {
          $project: {
            staffName: '$staff.full_name',
            username: '$staff.username',
            count: 1,
            totalRevenue: 1
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      // Thống kê hôm nay
      const today = new Date();
      const todayStart = new Date(today.setHours(0, 0, 0, 0));
      const todayEnd = new Date(today.setHours(23, 59, 59, 999));
      
      const todayStats = await Appointment.countDocuments({
        appointment_date: { $gte: todayStart, $lte: todayEnd }
      });

      res.status(200).json({
        success: true,
        message: 'Lấy thống kê thành công',
        data: {
          statusStats,
          serviceStats,
          staffStats,
          todayAppointments: todayStats,
          period: {
            from: date_from,
            to: date_to
          }
        }
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Lấy lịch hẹn theo ngày (calendar view)
  async getAppointmentsByDate(req, res) {
    try {
      const { date, staff_id } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin ngày'
        });
      }

      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const filter = {
        appointment_date: { $gte: startOfDay, $lte: endOfDay }
      };

      if (staff_id) {
        filter.staff_id = staff_id;
      }

      const appointments = await Appointment.find(filter)
        .populate('user_id', 'username full_name phone')
        .populate('pet_id', 'name breed_id')
        .populate('service_id', 'name duration')
        .populate('staff_id', 'username full_name')
        .sort({ appointment_time: 1 });

      // Tạo timeline view
      const timeSlots = [];
      for (let hour = 8; hour <= 17; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const slotAppointments = appointments.filter(apt => apt.appointment_time === timeString);
          
          timeSlots.push({
            time: timeString,
            appointments: slotAppointments,
            available: slotAppointments.length === 0
          });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Lấy lịch hẹn theo ngày thành công',
        data: {
          date,
          appointments,
          timeSlots,
          totalAppointments: appointments.length
        }
      });
    } catch (error) {
      console.error('Get appointments by date error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Bulk update appointments
  async bulkUpdateAppointments(req, res) {
    try {
      const { appointment_ids, updates } = req.body;
      const admin_user_id = req.user?.userId;

      if (!appointment_ids || !Array.isArray(appointment_ids) || appointment_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Danh sách ID lịch hẹn không hợp lệ'
        });
      }

      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Không có thông tin cập nhật'
        });
      }

      const results = [];
      const errors = [];

      for (const appointmentId of appointment_ids) {
        try {
          const appointment = await Appointment.findById(appointmentId);
          if (!appointment) {
            errors.push({
              id: appointmentId,
              error: 'Không tìm thấy lịch hẹn'
            });
            continue;
          }

          // Apply updates
          const updateData = { ...updates, updated_at: new Date() };
          
          const updatedAppointment = await Appointment.findByIdAndUpdate(
            appointmentId,
            updateData,
            { new: true }
          ).populate('user_id pet_id service_id staff_id');

          results.push(updatedAppointment);
        } catch (error) {
          errors.push({
            id: appointmentId,
            error: error.message
          });
        }
      }

      res.status(200).json({
        success: true,
        message: `Cập nhật thành công ${results.length}/${appointment_ids.length} lịch hẹn`,
        data: {
          updated: results,
          errors: errors,
          summary: {
            total: appointment_ids.length,
            success: results.length,
            failed: errors.length
          }
        }
      });
    } catch (error) {
      console.error('Bulk update appointments error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }
}

const adminAppointmentController = new AdminAppointmentController();

module.exports = {
  getAllAppointments: adminAppointmentController.getAllAppointments.bind(adminAppointmentController),
  updateAppointmentStatus: adminAppointmentController.updateAppointmentStatus.bind(adminAppointmentController),
  getAppointmentById: adminAppointmentController.getAppointmentById.bind(adminAppointmentController),
  getAvailableStaff: adminAppointmentController.getAvailableStaff.bind(adminAppointmentController),
  getDashboardStats: adminAppointmentController.getDashboardStats.bind(adminAppointmentController),
  getAppointmentsByDate: adminAppointmentController.getAppointmentsByDate.bind(adminAppointmentController),
  bulkUpdateAppointments: adminAppointmentController.bulkUpdateAppointments.bind(adminAppointmentController),
  assignStaffToAppointment: adminAppointmentController.assignStaffToAppointment.bind(adminAppointmentController),
  unassignStaffFromAppointment: adminAppointmentController.unassignStaffFromAppointment.bind(adminAppointmentController)
};