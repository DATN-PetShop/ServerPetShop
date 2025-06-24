const Voucher = require('../models/Voucher');
const BaseCrudController = require('./baseCrudController');

class VoucherController extends BaseCrudController {
  constructor() {
    super(Voucher);
  }

  getRequiredFields() {
    return ['discount_type', 'min_purchase_amount', 'expiry_date', 'user_id', 'category_id'];
  }

  getEntityName() {
    return 'Voucher';
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
        message: 'All vouchers retrieved successfully',
        data: vouchers
      });
    } catch (error) {
      console.error('Get all vouchers error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
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
        message: 'Search completed successfully',
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
      console.error('Search vouchers error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
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
  searchVouchers: voucherController.searchVouchers.bind(voucherController)
};