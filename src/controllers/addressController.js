const mongoose = require('mongoose');
const Address = require('../models/Address');

class AddressController {
  async addAddress(req, res) {
    try {
      const user_id = req.user.userId;
      const { name, phone, note, province, district, ward, postal_code, country, is_default } = req.body;

    if (!name || !phone || !note || !province || !district || !ward || !postal_code || !country) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
    }

    const address = new Address({
      user_id,
      name,
      phone,
      note,
      province,
      district,
      ward,
      postal_code,
      country,
      is_default: is_default || false
    });




      const saved = await address.save();
      res.status(201).json({ success: true, message: 'Thêm địa chỉ thành công', data: saved });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server', error });
    }
  }

  async getAddresses(req, res) {
    try {
      const user_id = req.user.userId;
      const addresses = await Address.find({ user_id }).sort({ createdAt: -1 });
      res.status(200).json({ success: true, message: 'Lấy danh sách địa chỉ thành công', data: addresses });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server', error });
    }
  }

  async getAddressById(req, res) {
    try {
      const user_id = req.user.userId;
      const { id } = req.params;

      const address = await Address.findOne({
        _id: new mongoose.Types.ObjectId(id),
        user_id: new mongoose.Types.ObjectId(user_id)
      });

      if (!address) return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ' });

      res.status(200).json({ success: true, message: 'Lấy địa chỉ thành công', data: address });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server', error });
    }
  }

  async updateAddress(req, res) {
    try {
      const user_id = req.user.userId;
      const { id } = req.params;
      const updateData = req.body;

      if (updateData.is_default) {
        await Address.updateMany({ user_id }, { is_default: false });
      }

      const updated = await Address.findOneAndUpdate(
        { _id: id, user_id },
        updateData,
        { new: true }
      );

      if (!updated) return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ' });
      res.status(200).json({ success: true, message: 'Cập nhật địa chỉ thành công', data: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server', error });
    }
  }

  async deleteAddress(req, res) {
    try {
      const user_id = req.user.userId;
      const { id } = req.params;
      const deleted = await Address.findOneAndDelete({ _id: id, user_id });

      if (!deleted) return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ' });
      res.status(200).json({ success: true, message: 'Xoá địa chỉ thành công' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server', error });
    }
  }

  async clearAddresses(req, res) {
    try {
      const user_id = req.user.userId;
      const result = await Address.deleteMany({ user_id });
      res.status(200).json({ success: true, message: `Đã xoá ${result.deletedCount} địa chỉ`, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server', error });
    }
  }

  async getAddressCount(req, res) {
    try {
      const user_id = req.user.userId;
      const count = await Address.countDocuments({ user_id });
      res.status(200).json({ success: true, message: 'Tổng địa chỉ', data: { count } });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server', error });
    }
  }

  async getDefaultAddress(req, res) {
    try {
      const user_id = req.user.userId;
      const defaultAddress = await Address.findOne({ user_id, is_default: true });

      if (!defaultAddress) {
        return res.status(404).json({ success: false, message: 'Chưa có địa chỉ mặc định' });
      }

      res.status(200).json({ success: true, message: 'Lấy địa chỉ mặc định thành công', data: defaultAddress });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server', error });
    }
  }
}

const controller = new AddressController();
module.exports = {
  addAddress: controller.addAddress.bind(controller),
  getAddresses: controller.getAddresses.bind(controller),
  getAddressById: controller.getAddressById.bind(controller),
  updateAddress: controller.updateAddress.bind(controller),
  deleteAddress: controller.deleteAddress.bind(controller),
  clearAddresses: controller.clearAddresses.bind(controller),
  getAddressCount: controller.getAddressCount.bind(controller),
  getDefaultAddress: controller.getDefaultAddress.bind(controller)
};

