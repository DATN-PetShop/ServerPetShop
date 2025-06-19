const Breed = require('../models/Breed');
const Category = require('../models/Category');
const BaseCrudController = require('./baseCrudController');

class BreedController extends BaseCrudController {
  constructor() {
    super(Breed);
  }

  getRequiredFields() {
    return ['name', 'category_id'];
  }

  getEntityName() {
    return 'Breed';
  }

  async getAll(req, res) {
    try {
      const breeds = await this.model.find().populate('category_id', 'name description').lean();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Breeds retrieved successfully',
        data: breeds
      });
    } catch (error) {
      console.error('Get all breeds error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getBreedsByCategory(req, res) {
    try {
      const { categoryId } = req.params;
      
      const breeds = await this.model.find({ category_id: categoryId })
        .populate('category_id', 'name description')
        .lean();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Breeds by category retrieved successfully',
        data: breeds
      });
    } catch (error) {
      console.error('Get breeds by category error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async create(req, res) {
    try {
      const { category_id } = req.body;

      const category = await Category.findById(category_id);
      if (!category) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Category not found',
          data: null
        });
      }

      // Call parent create method
      return super.create(req, res);
    } catch (error) {
      console.error('Create breed error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
}

const breedController = new BreedController();

module.exports = {
  createBreed: breedController.create.bind(breedController),
  getAllBreeds: breedController.getAll.bind(breedController),
  getBreedsByCategory: breedController.getBreedsByCategory.bind(breedController),
  updateBreed: breedController.update.bind(breedController),
  deleteBreed: breedController.delete.bind(breedController)
};