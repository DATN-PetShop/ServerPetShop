// src/controllers/voucherController.js
const Voucher = require('../models/Voucher');
const BaseCrudController = require('./baseCrudController'); // Đảm bảo BaseCrudController tồn tại và được import đúng
const mongoose = require('mongoose'); // Import mongoose để sử dụng Types.ObjectId

class VoucherController extends BaseCrudController {
  constructor() {
    super(Voucher);
  }

  // Định nghĩa các trường bắt buộc khi tạo voucher
  getRequiredFields() {
    return ['discount_type', 'min_purchase_amount', 'expiry_date', 'category_id', 'discount_value'];
  }

  // Tên thực thể cho các thông báo
  getEntityName() {
    return 'Voucher';
  }

  // Phương thức tạo voucher mới
  async create(req, res) {
    try {
      const body = req.body;
      const requiredFields = this.getRequiredFields();
      const missingFields = requiredFields.filter(field => !body[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: `Các trường bắt buộc bị thiếu: ${missingFields.join(', ')}`,
          data: null
        });
      }

      // Gán user_id và created_by từ req.user.id (từ token đã xác thực)
      const voucherData = {
        ...body,
        user_id: body.user_id || req.user.id, // Sử dụng req.user.id nếu user_id không có trong body
        created_by: req.user.id,
      };

      const voucher = new this.model(voucherData);
      await voucher.save();

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Tạo voucher thành công',
        data: voucher
      });
    } catch (error) {
      console.error('Lỗi khi tạo voucher:', error);
      res.status(400).json({
        success: false,
        statusCode: 400,
        message: error.message || 'Lỗi khi tạo voucher',
        data: null
      });
    }
  }

  // Phương thức lấy tất cả các voucher
  async getAllVouchers(req, res) {
    try {
      const vouchers = await this.model.find()
        .populate('user_id', 'username email')
        .populate('category_id', 'name description')
        .populate('created_by', 'username email') // Populate thông tin người tạo
        .populate('last_modified_by', 'username email') // Populate thông tin người sửa cuối cùng
        .lean(); // Sử dụng .lean() để trả về plain JavaScript objects, nhanh hơn

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Tất cả các voucher đã được lấy thành công',
        data: vouchers
      });
    } catch (error) {
      console.error('Lỗi khi lấy tất cả voucher:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi máy chủ nội bộ',
        data: null
      });
    }
  }

  // Phương thức cập nhật voucher theo ID
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        last_modified_by: req.user.id, // Gán ID người dùng đã xác thực là người sửa cuối cùng
        updated_at: new Date() // Cập nhật thời gian sửa đổi
      };

      // Tìm và cập nhật voucher bằng ID
      const voucher = await this.model.findByIdAndUpdate(
        id,
        updateData,
        { 
          new: true, // Trả về document sau khi update
          runValidators: true // Chạy validation trên schema trước khi lưu
        }
      )
      .populate('user_id', 'username email')
      .populate('category_id', 'name description')
      .populate('created_by', 'username email')
      .populate('last_modified_by', 'username email');

      if (!voucher) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Không tìm thấy voucher',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Cập nhật voucher thành công',
        data: voucher
      });
    } catch (error) {
      console.error('Lỗi khi cập nhật voucher:', error);
      
      // Xử lý lỗi validation từ Mongoose schema
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Dữ liệu không hợp lệ: ' + error.message,
          data: error.errors
        });
      }
      // Xử lý lỗi khi ID không đúng định dạng ObjectId
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'ID voucher không hợp lệ.',
          data: null
        });
      }

      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi máy chủ nội bộ.',
        data: null
      });
    }
  }

  // Phương thức xóa voucher theo ID
  async delete(req, res) {
    try {
      const { id } = req.params;

      const voucher = await this.model.findByIdAndDelete(id);

      if (!voucher) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Không tìm thấy voucher',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Xóa voucher thành công',
        data: voucher
      });
    } catch (error) {
      console.error('Lỗi khi xóa voucher:', error);
      
      // Xử lý lỗi khi ID không đúng định dạng ObjectId
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'ID voucher không hợp lệ.',
          data: null
        });
      }

      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi máy chủ nội bộ.',
        data: null
      });
    }
  }

  // Phương thức tìm kiếm voucher với các bộ lọc và phân trang
  async searchVouchers(req, res) {
    try {
      const {
        discount_type,
        min_purchase_amount,
        max_purchase_amount,
        status, // Sử dụng 'status' để lọc (active, inactive, expired, pending)
        min_usage,
        max_usage,
        page = 1,
        limit = 10
      } = req.query;

      const filter = {};

      if (discount_type) {
        filter.discount_type = discount_type;
      }

      if (min_purchase_amount || max_purchase_amount) {
        filter.min_purchase_amount = {};
        if (min_purchase_amount) filter.min_purchase_amount.$gte = Number(min_purchase_amount);
        if (max_purchase_amount) filter.min_purchase_amount.$lte = Number(max_purchase_amount);
      }

      if (status) { // Lọc theo trạng thái của voucher
        filter.status = status;
      }

      if (min_usage || max_usage) {
        filter.max_usage = {};
        if (min_usage) filter.max_usage.$gte = Number(min_usage);
        if (max_usage) filter.max_usage.$lte = Number(max_usage);
      }

      const skip = (Number(page) - 1) * Number(limit);
      const vouchers = await this.model.find(filter)
        .populate('user_id', 'username email')
        .populate('category_id', 'name description')
        .populate('created_by', 'username email') // Populate thông tin người tạo
        .populate('last_modified_by', 'username email') // Populate thông tin người sửa cuối cùng
        .skip(skip)
        .limit(Number(limit))
        .lean();

      const totalCount = await this.model.countDocuments(filter);
      const totalPages = Math.ceil(totalCount / Number(limit));

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Tìm kiếm hoàn tất thành công',
        data: {
          vouchers,
          pagination: {
            currentPage: Number(page),
            totalPages,
            totalCount,
            limit: Number(limit)
          }
        }
      });
    } catch (error) {
      console.error('Lỗi khi tìm kiếm voucher:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi máy chủ nội bộ',
        data: null
      });
    }
  }

  // Phương thức cho phép người dùng lưu voucher
  async saveVoucher(req, res) {
    try {
      const { voucherId } = req.params;
      
      // Lấy userId từ req.user (đã được auth middleware đảm bảo có .id)
      const userId = req.user?.id; 

      if (!userId) {
        return res.status(401).json({
          success: false,
          statusCode: 401,
          message: 'Người dùng chưa được xác thực',
          data: null
        });
      }

      const voucher = await this.model.findById(voucherId);
      if (!voucher) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Không tìm thấy voucher',
          data: null
        });
      }

      // Kiểm tra trạng thái voucher
      if (voucher.status !== 'active') {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Voucher không hoạt động',
          data: null
        });
      }

      // Kiểm tra giới hạn sử dụng
      if (voucher.used_count >= voucher.max_usage) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Voucher đã đạt giới hạn sử dụng tối đa',
          data: null
        });
      }

      // Kiểm tra ngày hết hạn
      if (new Date(voucher.expiry_date) < new Date()) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Voucher đã hết hạn',
          data: null
        });
      }

      // Đảm bảo saved_by_users là một mảng
      if (!voucher.saved_by_users) {
        voucher.saved_by_users = [];
      }
      
      // Chuyển đổi userId sang ObjectId để so sánh và lưu trữ chính xác
      const userIdObjectId = new mongoose.Types.ObjectId(userId);

      // Kiểm tra xem người dùng đã lưu voucher này chưa
      if (!voucher.saved_by_users.some(id => id.equals(userIdObjectId))) {
        voucher.saved_by_users.push(userIdObjectId); // Thêm ID người dùng vào danh sách đã lưu
        // Lưu ý: used_count không tăng khi lưu, chỉ tăng khi voucher được áp dụng thực tế
        await voucher.save();
      } else {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Bạn đã lưu voucher này trước đó',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Voucher đã được lưu thành công',
        data: voucher
      });
    } catch (error) {
      console.error('Lỗi khi lưu voucher:', error);
      // Xử lý lỗi khi ID không đúng định dạng ObjectId
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'ID voucher hoặc ID người dùng không hợp lệ.',
          data: null
        });
      }
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi máy chủ nội bộ',
        data: null
      });
    }
  }
}

const voucherController = new VoucherController();

// Export các phương thức để sử dụng trong router
module.exports = {
  createVoucher: voucherController.create.bind(voucherController),
  getAllVouchers: voucherController.getAllVouchers.bind(voucherController),
  updateVoucher: voucherController.update.bind(voucherController),
  deleteVoucher: voucherController.delete.bind(voucherController),
  searchVouchers: voucherController.searchVouchers.bind(voucherController),
  saveVoucher: voucherController.saveVoucher.bind(voucherController)
};