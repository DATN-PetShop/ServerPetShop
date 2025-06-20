const mongoose = require('mongoose');
const Address = require('../models/Address');

class AddressController {
  // Thêm địa chỉ mới
  async addAddress(req, res) {
    try {
      const user_id = req.user.userId;
      const { name, phone, province, addressDetail } = req.body;

      if (!name || !phone || !province || !addressDetail) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Thiếu thông tin bắt buộc',
          data: null
        });
      }

      const newAddress = new Address({
        user_id: new mongoose.Types.ObjectId(user_id),
        name,
        phone,
        province,
        addressDetail
      });

      const saved = await newAddress.save();

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Thêm địa chỉ thành công',
        data: saved
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi server',
        data: null
      });
    }
  }

  // Lấy danh sách địa chỉ của user
  async getAddresses(req, res) {
    try {
      const user_id = req.user.userId;
      const addresses = await Address.find({ user_id }).sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy danh sách địa chỉ thành công',
        data: addresses
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi server',
        data: null
      });
    }
  }

  // Cập nhật địa chỉ
  async updateAddress(req, res) {
    try {
      const user_id = req.user.userId;
      const { id } = req.params;
      const updateData = req.body;

      const updated = await Address.findOneAndUpdate(
        { _id: id, user_id },
        updateData,
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Không tìm thấy địa chỉ để cập nhật',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Cập nhật địa chỉ thành công',
        data: updated
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi server',
        data: null
      });
    }
  }

  // Xoá một địa chỉ
  async deleteAddress(req, res) {
    try {
      const user_id = req.user.userId;
      const { id } = req.params;

      const deleted = await Address.findOneAndDelete({ _id: id, user_id });

      if (!deleted) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Không tìm thấy địa chỉ để xoá',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Xoá địa chỉ thành công',
        data: null
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi server',
        data: null
      });
    }
  }

  // Xoá toàn bộ địa chỉ của user
  async clearAddresses(req, res) {
    try {
      const user_id = req.user.userId;
      const result = await Address.deleteMany({ user_id });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Đã xoá toàn bộ địa chỉ (${result.deletedCount})`,
        data: { deletedCount: result.deletedCount }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi server',
        data: null
      });
    }
  }

  // Lấy tổng số địa chỉ
  async getAddressCount(req, res) {
    try {
      const user_id = req.user.userId;

      const count = await Address.countDocuments({ user_id });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy số lượng địa chỉ thành công',
        data: { count }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi server',
        data: null
      });
    }
  }
}

// Khởi tạo và export các method đã bind
const addressController = new AddressController();

module.exports = {
  addAddress: addressController.addAddress.bind(addressController),
  getAddresses: addressController.getAddresses.bind(addressController),
  updateAddress: addressController.updateAddress.bind(addressController),
  deleteAddress: addressController.deleteAddress.bind(addressController),
  clearAddresses: addressController.clearAddresses.bind(addressController),
  getAddressCount: addressController.getAddressCount.bind(addressController),
};
