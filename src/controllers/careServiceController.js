// src/controllers/careServiceController.js
const CareService = require('../models/CareService');

class CareServiceController {
  // Tạo dịch vụ mới (Admin/Staff)
  async createService(req, res) {
    try {
      const { name, description, price, duration, category } = req.body;

      // Validation
      if (!name || !price || !duration || !category) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin bắt buộc'
        });
      }

      // Kiểm tra tên dịch vụ đã tồn tại
      const existingService = await CareService.findOne({ name });
      if (existingService) {
        return res.status(409).json({
          success: false,
          message: 'Tên dịch vụ đã tồn tại'
        });
      }

      const service = new CareService({
        name,
        description,
        price,
        duration,
        category
      });

      await service.save();

      res.status(201).json({
        success: true,
        message: 'Tạo dịch vụ thành công',
        data: service
      });
    } catch (error) {
      console.error('Create service error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Lấy tất cả dịch vụ
  async getAllServices(req, res) {
    try {
      const { category, active } = req.query;

      // Tạo filter
      const filter = {};
      if (category) {
        filter.category = category;
      }
      if (active !== undefined) {
        filter.is_active = active === 'true';
      }

      const services = await CareService.find(filter).sort({ name: 1 });

      res.status(200).json({
        success: true,
        message: 'Lấy danh sách dịch vụ thành công',
        data: services
      });
    } catch (error) {
      console.error('Get all services error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Lấy dịch vụ theo ID
  async getServiceById(req, res) {
    try {
      const { id } = req.params;

      const service = await CareService.findById(id);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy dịch vụ'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Lấy thông tin dịch vụ thành công',
        data: service
      });
    } catch (error) {
      console.error('Get service by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Cập nhật dịch vụ (Admin/Staff)
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

      // Kiểm tra tên dịch vụ trùng (nếu thay đổi tên)
      if (name && name !== service.name) {
        const existingService = await CareService.findOne({ name, _id: { $ne: id } });
        if (existingService) {
          return res.status(409).json({
            success: false,
            message: 'Tên dịch vụ đã tồn tại'
          });
        }
      }

      // Cập nhật thông tin
      if (name) service.name = name;
      if (description !== undefined) service.description = description;
      if (price) service.price = price;
      if (duration) service.duration = duration;
      if (category) service.category = category;
      if (is_active !== undefined) service.is_active = is_active;

      await service.save();

      res.status(200).json({
        success: true,
        message: 'Cập nhật dịch vụ thành công',
        data: service
      });
    } catch (error) {
      console.error('Update service error:', error);
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

      // Kiểm tra xem có lịch hẹn nào đang sử dụng dịch vụ này không
      const Appointment = require('../models/Appointment');
      const appointmentCount = await Appointment.countDocuments({ 
        service_id: id, 
        status: { $nin: ['cancelled'] } 
      });

      if (appointmentCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Không thể xóa dịch vụ đang được sử dụng trong lịch hẹn'
        });
      }

      await CareService.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Xóa dịch vụ thành công'
      });
    } catch (error) {
      console.error('Delete service error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Lấy danh sách categories
  async getCategories(req, res) {
    try {
      const categories = [
        { value: 'grooming', label: 'Làm đẹp' },
        { value: 'health', label: 'Sức khỏe' },
        { value: 'bathing', label: 'tắm rửa' },
        { value: 'spa', label: 'spa' },
        { value: 'other', label: 'Khác' }
      ];

      res.status(200).json({
        success: true,
        message: 'Lấy danh sách categories thành công',
        data: categories
      });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // Lấy dịch vụ theo category
  async getServicesByCategory(req, res) {
    try {
      const { category } = req.params;

      const services = await CareService.find({ 
        category, 
        is_active: true 
      }).sort({ name: 1 });

      res.status(200).json({
        success: true,
        message: 'Lấy dịch vụ theo category thành công',
        data: services
      });
    } catch (error) {
      console.error('Get services by category error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }
}

const careServiceController = new CareServiceController();

module.exports = {
  createService: careServiceController.createService.bind(careServiceController),
  getAllServices: careServiceController.getAllServices.bind(careServiceController),
  getServiceById: careServiceController.getServiceById.bind(careServiceController),
  updateService: careServiceController.updateService.bind(careServiceController),
  deleteService: careServiceController.deleteService.bind(careServiceController),
  getCategories: careServiceController.getCategories.bind(careServiceController),
  getServicesByCategory: careServiceController.getServicesByCategory.bind(careServiceController)
};