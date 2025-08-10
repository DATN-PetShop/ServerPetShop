// src/controllers/Admin/AdminCareServiceController.js
const CareService = require('../../models/CareService');
const Appointment = require('../../models/Appointment');

class AdminCareServiceController {
  // Lấy tất cả dịch vụ với filter, search, pagination (Admin)
  async getAllServices(req, res) {
    try {
      const { 
        category, 
        active, 
        search,
        page = 1, 
        limit = 10,
        sort_by = 'name',
        sort_order = 'asc'
      } = req.query;

      console.log('Admin getAllServices - Query params:', req.query);

      // Tạo filter object
      const filter = {};
      
      // Filter theo category
      if (category && category !== 'all') {
        filter.category = category;
      }

      // Filter theo trạng thái active
      if (active !== undefined) {
        filter.is_active = active === 'true';
      }

      // Tìm kiếm theo tên hoặc mô tả
      if (search && search.trim()) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      console.log('Admin getAllServices - Filter:', filter);

      // Tạo sort object
      const sortObj = {};
      sortObj[sort_by] = sort_order === 'desc' ? -1 : 1;

      // Tính toán pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Lấy dữ liệu với pagination
      const [services, totalCount] = await Promise.all([
        CareService.find(filter)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum),
        CareService.countDocuments(filter)
      ]);

      // Tính số lượng appointment cho mỗi dịch vụ
      const servicesWithStats = await Promise.all(
        services.map(async (service) => {
          const appointmentCount = await Appointment.countDocuments({
            service_id: service._id,
            status: { $nin: ['cancelled'] }
          });

          return {
            ...service.toObject(),
            appointment_count: appointmentCount
          };
        })
      );

      // Tính toán metadata pagination
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.status(200).json({
        success: true,
        message: 'Lấy danh sách dịch vụ thành công',
        data: {
          services: servicesWithStats,
          pagination: {
            current_page: pageNum,
            total_pages: totalPages,
            total_count: totalCount,
            limit: limitNum,
            has_next_page: hasNextPage,
            has_prev_page: hasPrevPage
          },
          filters: {
            category,
            active,
            search,
            sort_by,
            sort_order
          }
        }
      });
    } catch (error) {
      console.error('Admin get all services error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Lấy chi tiết dịch vụ (Admin) - có thêm thống kê
  async getServiceDetails(req, res) {
    try {
      const { id } = req.params;

      const service = await CareService.findById(id);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy dịch vụ'
        });
      }

      // Thống kê appointment cho dịch vụ này
      const [
        totalAppointments,
        completedAppointments,
        pendingAppointments,
        cancelledAppointments,
        totalRevenue
      ] = await Promise.all([
        Appointment.countDocuments({ service_id: id }),
        Appointment.countDocuments({ service_id: id, status: 'completed' }),
        Appointment.countDocuments({ service_id: id, status: 'pending' }),
        Appointment.countDocuments({ service_id: id, status: 'cancelled' }),
        Appointment.aggregate([
          { $match: { service_id: service._id, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$total_amount' } } }
        ])
      ]);

      // Lấy appointments gần đây
      const recentAppointments = await Appointment.find({ service_id: id })
        .populate('user_id', 'username email')
        .populate('pet_id', 'name breed')
        .sort({ appointment_date: -1 })
        .limit(5);

      res.status(200).json({
        success: true,
        message: 'Lấy chi tiết dịch vụ thành công',
        data: {
          service: service.toObject(),
          statistics: {
            total_appointments: totalAppointments,
            completed_appointments: completedAppointments,
            pending_appointments: pendingAppointments,
            cancelled_appointments: cancelledAppointments,
            completion_rate: totalAppointments > 0 ? (completedAppointments / totalAppointments * 100).toFixed(2) : 0,
            total_revenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0
          },
          recent_appointments: recentAppointments
        }
      });
    } catch (error) {
      console.error('Admin get service details error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Tạo dịch vụ mới (Admin)
  async createService(req, res) {
    try {
      const { name, description, price, duration, category } = req.body;

      // Validation chi tiết
      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Tên dịch vụ là bắt buộc'
        });
      }

      if (!price && price !== 0) {
        return res.status(400).json({
          success: false,
          message: 'Giá dịch vụ là bắt buộc'
        });
      }

      if (price < 0) {
        return res.status(400).json({
          success: false,
          message: 'Giá dịch vụ không thể âm'
        });
      }

      if (!duration || duration < 15) {
        return res.status(400).json({
          success: false,
          message: 'Thời gian thực hiện tối thiểu 15 phút'
        });
      }

      if (!category || !['grooming', 'health', 'bathing', 'spa', 'other'].includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Danh mục không hợp lệ'
        });
      }

      // Kiểm tra tên dịch vụ đã tồn tại
      const existingService = await CareService.findOne({ 
        name: { $regex: `^${name.trim()}$`, $options: 'i' } 
      });
      if (existingService) {
        return res.status(409).json({
          success: false,
          message: 'Tên dịch vụ đã tồn tại'
        });
      }

      const service = new CareService({
        name: name.trim(),
        description: description ? description.trim() : '',
        price: Number(price),
        duration: Number(duration),
        category
      });

      await service.save();

      res.status(201).json({
        success: true,
        message: 'Tạo dịch vụ thành công',
        data: service
      });
    } catch (error) {
      console.error('Admin create service error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Cập nhật dịch vụ (Admin)
  async updateService(req, res) {
    try {
      const { id } = req.params;
      const { name, description, price, duration, category, is_active } = req.body;

      const service = await CareService.findById(id);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy dịch vụ'
        });
      }

      // Validation cho các trường được cập nhật
      if (name !== undefined) {
        if (!name || name.trim() === '') {
          return res.status(400).json({
            success: false,
            message: 'Tên dịch vụ không được để trống'
          });
        }

        // Kiểm tra tên trùng (trừ chính nó)
        const existingService = await CareService.findOne({ 
          name: { $regex: `^${name.trim()}$`, $options: 'i' },
          _id: { $ne: id } 
        });
        if (existingService) {
          return res.status(409).json({
            success: false,
            message: 'Tên dịch vụ đã tồn tại'
          });
        }
        service.name = name.trim();
      }

      if (description !== undefined) {
        service.description = description ? description.trim() : '';
      }

      if (price !== undefined) {
        if (price < 0) {
          return res.status(400).json({
            success: false,
            message: 'Giá dịch vụ không thể âm'
          });
        }
        service.price = Number(price);
      }

      if (duration !== undefined) {
        if (duration < 15) {
          return res.status(400).json({
            success: false,
            message: 'Thời gian thực hiện tối thiểu 15 phút'
          });
        }
        service.duration = Number(duration);
      }

      if (category !== undefined) {
        if (!['grooming', 'health', 'bathing', 'spa', 'other'].includes(category)) {
          return res.status(400).json({
            success: false,
            message: 'Danh mục không hợp lệ'
          });
        }
        service.category = category;
      }

      if (is_active !== undefined) {
        service.is_active = Boolean(is_active);
      }

      await service.save();

      res.status(200).json({
        success: true,
        message: 'Cập nhật dịch vụ thành công',
        data: service
      });
    } catch (error) {
      console.error('Admin update service error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Xóa dịch vụ (Admin)
  async deleteService(req, res) {
    try {
      const { id } = req.params;

      const service = await CareService.findById(id);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy dịch vụ'
        });
      }

      // Kiểm tra có appointment nào đang sử dụng dịch vụ này không
      const activeAppointmentCount = await Appointment.countDocuments({ 
        service_id: id, 
        status: { $nin: ['cancelled', 'completed'] } 
      });

      if (activeAppointmentCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Không thể xóa dịch vụ vì có ${activeAppointmentCount} lịch hẹn đang hoạt động`
        });
      }

      await CareService.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Xóa dịch vụ thành công'
      });
    } catch (error) {
      console.error('Admin delete service error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Bulk operations - Cập nhật nhiều dịch vụ cùng lúc
  async bulkUpdateServices(req, res) {
    try {
      const { service_ids, updates } = req.body;

      if (!service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Danh sách ID dịch vụ không hợp lệ'
        });
      }

      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu cập nhật không được để trống'
        });
      }

      // Validate updates
      const allowedUpdates = ['category', 'is_active', 'price'];
      const updateKeys = Object.keys(updates);
      const invalidKeys = updateKeys.filter(key => !allowedUpdates.includes(key));

      if (invalidKeys.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Các trường không được phép cập nhật: ${invalidKeys.join(', ')}`
        });
      }

      // Validation cho từng trường
      if (updates.category && !['grooming', 'health', 'bathing', 'spa', 'other'].includes(updates.category)) {
        return res.status(400).json({
          success: false,
          message: 'Danh mục không hợp lệ'
        });
      }

      if (updates.price !== undefined && (updates.price < 0 || isNaN(updates.price))) {
        return res.status(400).json({
          success: false,
          message: 'Giá dịch vụ không hợp lệ'
        });
      }

      // Thực hiện bulk update
      const updateData = { ...updates, updated_at: new Date() };
      
      const result = await CareService.updateMany(
        { _id: { $in: service_ids } },
        { $set: updateData }
      );

      res.status(200).json({
        success: true,
        message: `Cập nhật thành công ${result.modifiedCount}/${service_ids.length} dịch vụ`,
        data: {
          matched: result.matchedCount,
          modified: result.modifiedCount,
          total_requested: service_ids.length
        }
      });
    } catch (error) {
      console.error('Admin bulk update services error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Lấy thống kê tổng quan dịch vụ
  async getServiceStatistics(req, res) {
    try {
      const { date_from, date_to } = req.query;

      // Thống kê cơ bản về dịch vụ
      const [
        totalServices,
        activeServices,
        inactiveServices,
        servicesByCategory
      ] = await Promise.all([
        CareService.countDocuments(),
        CareService.countDocuments({ is_active: true }),
        CareService.countDocuments({ is_active: false }),
        CareService.aggregate([
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
              avg_price: { $avg: '$price' },
              avg_duration: { $avg: '$duration' }
            }
          },
          { $sort: { count: -1 } }
        ])
      ]);

      // Filter thời gian cho appointment statistics
      const dateFilter = {};
      if (date_from || date_to) {
        dateFilter.appointment_date = {};
        if (date_from) dateFilter.appointment_date.$gte = new Date(date_from);
        if (date_to) dateFilter.appointment_date.$lte = new Date(date_to);
      }

      // Thống kê appointment theo dịch vụ
      const serviceAppointmentStats = await Appointment.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$service_id',
            total_appointments: { $sum: 1 },
            completed_appointments: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            total_revenue: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$total_amount', 0] }
            }
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
        { $unwind: '$service' },
        {
          $project: {
            service_name: '$service.name',
            category: '$service.category',
            total_appointments: 1,
            completed_appointments: 1,
            total_revenue: 1,
            completion_rate: {
              $cond: [
                { $gt: ['$total_appointments', 0] },
                { $multiply: [{ $divide: ['$completed_appointments', '$total_appointments'] }, 100] },
                0
              ]
            }
          }
        },
        { $sort: { total_revenue: -1 } },
        { $limit: 10 }
      ]);

      res.status(200).json({
        success: true,
        message: 'Lấy thống kê dịch vụ thành công',
        data: {
          overview: {
            total_services: totalServices,
            active_services: activeServices,
            inactive_services: inactiveServices
          },
          categories: servicesByCategory,
          top_services: serviceAppointmentStats,
          date_range: {
            from: date_from || null,
            to: date_to || null
          }
        }
      });
    } catch (error) {
      console.error('Admin get service statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Toggle trạng thái active/inactive
  async toggleServiceStatus(req, res) {
    try {
      const { id } = req.params;

      const service = await CareService.findById(id);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy dịch vụ'
        });
      }

      service.is_active = !service.is_active;
      await service.save();

      res.status(200).json({
        success: true,
        message: `${service.is_active ? 'Kích hoạt' : 'Vô hiệu hóa'} dịch vụ thành công`,
        data: {
          id: service._id,
          name: service.name,
          is_active: service.is_active
        }
      });
    } catch (error) {
      console.error('Admin toggle service status error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }
}

const adminCareServiceController = new AdminCareServiceController();

module.exports = {
  getAllServices: adminCareServiceController.getAllServices.bind(adminCareServiceController),
  getServiceDetails: adminCareServiceController.getServiceDetails.bind(adminCareServiceController),
  createService: adminCareServiceController.createService.bind(adminCareServiceController),
  updateService: adminCareServiceController.updateService.bind(adminCareServiceController),
  deleteService: adminCareServiceController.deleteService.bind(adminCareServiceController),
  bulkUpdateServices: adminCareServiceController.bulkUpdateServices.bind(adminCareServiceController),
  getServiceStatistics: adminCareServiceController.getServiceStatistics.bind(adminCareServiceController),
  toggleServiceStatus: adminCareServiceController.toggleServiceStatus.bind(adminCareServiceController)
};