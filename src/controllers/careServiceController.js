// src/controllers/careServiceController.js
const CareService = require('../models/CareService');

class CareServiceController {
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
  getAllServices: careServiceController.getAllServices.bind(careServiceController),
  getServiceById: careServiceController.getServiceById.bind(careServiceController),
  getCategories: careServiceController.getCategories.bind(careServiceController),
  getServicesByCategory: careServiceController.getServicesByCategory.bind(careServiceController)
};