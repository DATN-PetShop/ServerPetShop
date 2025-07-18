const Favourite = require('../models/Favourite');
const BaseCrudController = require('./baseCrudController');

class FavouriteController extends BaseCrudController {
  constructor() {
    super(Favourite);
  }

  getRequiredFields() {
    return ['user_id', 'pet_id', 'product_id'];
  }

  getEntityName() {
    return 'Favourite';
  }

  async create(req, res) {
    try {
      const { user_id, pet_id, product_id } = req.body;

      const existingFavourite = await this.model.findOne({
        user_id,
        $or: [{ pet_id }, { product_id }]
      });

      if (existingFavourite) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Favourite already exists for this user and pet/product',
          data: null
        });
      }

      const favourite = new this.model({
        user_id,
        pet_id,
        product_id,
        created_at: new Date()
      });

      const savedFavourite = await favourite.save();
      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Favourite created successfully',
        data: savedFavourite
      });
    } catch (error) {
      console.error('Create favourite error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getAll(req, res) {
    try {
      const favourites = await this.model.find()
        .populate('user_id', 'username email')
        .populate('pet_id', 'name price')
        .populate('product_id', 'name price')
        .lean();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Favourites retrieved successfully',
        data: favourites
      });
    } catch (error) {
      console.error('Get all favourites error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const favourite = await this.model.findById(id)
        .populate('user_id', 'username email')
        .populate('pet_id', 'name price')
        .populate('product_id', 'name price')
        .lean();

      if (!favourite) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Favourite not found',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Favourite retrieved successfully',
        data: favourite
      });
    } catch (error) {
      console.error('Get favourite by ID error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { user_id, pet_id, product_id } = req.body;

      const favourite = await this.model.findById(id);
      if (!favourite) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Favourite not found',
          data: null
        });
      }

      if (user_id) favourite.user_id = user_id;
      if (pet_id) favourite.pet_id = pet_id;
      if (product_id) favourite.product_id = product_id;
      favourite.updated_at = new Date();

      const updatedFavourite = await favourite.save();
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Favourite updated successfully',
        data: updatedFavourite
      });
    } catch (error) {
      console.error('Update favourite error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const favourite = await this.model.findByIdAndDelete(id);

      if (!favourite) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Favourite not found',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Favourite deleted successfully',
        data: null
      });
    } catch (error) {
      console.error('Delete favourite error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
}

const favouriteController = new FavouriteController();

module.exports = {
  createFavourite: favouriteController.create.bind(favouriteController),
  getAllFavourites: favouriteController.getAll.bind(favouriteController),
  getFavouriteById: favouriteController.getById.bind(favouriteController),
  updateFavourite: favouriteController.update.bind(favouriteController),
  deleteFavourite: favouriteController.delete.bind(favouriteController)
};