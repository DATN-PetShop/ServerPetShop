const Address = require('../models/Address');
const BaseCrudController = require('./baseCrudController');

class AddressController extends BaseCrudController {
  constructor() {
    super(Address);
  }

  getRequiredFields() {
    return ['street', 'city', 'state', 'postal_code', 'country', 'user_id'];
  }

  getEntityName() {
    return 'Address';
  }

  // Lấy chi tiết một bản ghi
  async getById(req, res) {
    try {
      const address = await this.model.findOne({ _id: req.params.id })
        .populate('user_id', 'username email')
        .lean();

      if (!address) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Address not found',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Address retrieved successfully',
        data: address
      });
    } catch (error) {
      console.error('Get address by ID error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
}

const addressController = new AddressController();

module.exports = {
  createAddress: addressController.create.bind(addressController),
  getAllAddresses: addressController.getAll.bind(addressController),
  getAddressById: addressController.getById.bind(addressController),
  updateAddress: addressController.update.bind(addressController),
  deleteAddress: addressController.delete.bind(addressController)
};