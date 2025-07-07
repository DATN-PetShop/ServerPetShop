// src/controllers/voucherController.js
const Voucher = require('../models/Voucher');
const BaseCrudController = require('./baseCrudController');

class VoucherController extends BaseCrudController {
  constructor() {
    super(Voucher);
  }

  getRequiredFields() {
    return ['discount_type', 'min_purchase_amount', 'expiry_date', 'category_id']; // Loại bỏ user_id
  }

  getEntityName() {
    return 'Voucher';
  }

  async create(req, res) {
    try {
      const body = req.body;
      const requiredFields = this.getRequiredFields();
      const missingFields = requiredFields.filter(field => !body[field]);
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: `${missingFields.join(', ')} is required`,
          data: null
        });
      }

      // Gán user_id và created_by từ req.user.id (từ token)
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

  async getAllVouchers(req, res) {
    try {
      const vouchers = await this.model.find()
        .populate('user_id', 'username email')
        .populate('category_id', 'name description')
        .lean();

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

  async searchVouchers(req, res) {
    try {
      const {
        discount_type,
        min_purchase_amount,
        max_purchase_amount,
        is_active,
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

      if (is_active !== undefined) {
        filter.is_active = is_active === 'true';
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

  async saveVoucher(req, res) {
    try {
      const { voucherId } = req.params;
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

      if (voucher.status !== 'active') {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Voucher không hoạt động',
          data: null
        });
      }

      if (voucher.used_count >= voucher.max_usage) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Voucher đã đạt giới hạn sử dụng tối đa',
          data: null
        });
      }

      if (new Date(voucher.expiry_date) < new Date()) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Voucher đã hết hạn',
          data: null
        });
      }

      if (!voucher.saved_by_users) {
        voucher.saved_by_users = [];
      }
      if (!voucher.saved_by_users.includes(userId)) {
        voucher.saved_by_users.push(userId);
        voucher.used_count += 1;
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

module.exports = {
  createVoucher: voucherController.create.bind(voucherController),
  getAllVouchers: voucherController.getAllVouchers.bind(voucherController),
  updateVoucher: voucherController.update.bind(voucherController),
  deleteVoucher: voucherController.delete.bind(voucherController),
  searchVouchers: voucherController.searchVouchers.bind(voucherController),
  saveVoucher: voucherController.saveVoucher.bind(voucherController)
};