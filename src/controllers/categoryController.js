const Category = require('../models/Category');
const BaseCrudController = require('./baseCrudController');

class CategoryController extends BaseCrudController {
  constructor() {
    super(Category); // Category không có image model
  }

  getRequiredFields() {
    return ['name'];
  }

  getEntityName() {
    return 'Category';
  }

  // Override getAll để không filter theo user_id (categories là public)
  async getAll(req, res) {
    try {
      const categories = await this.model.find().lean();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Categories retrieved successfully',
        data: categories
      });
    } catch (error) {
      console.error('Get all categories error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Override create để không thêm user_id
  async create(req, res) {
    try {
      const requiredFields = this.getRequiredFields();
      const data = { ...req.body }; // Không thêm user_id

      for (const field of requiredFields) {
        if (!data[field]) {
          return res.status(400).json({
            success: false,
            statusCode: 400,
            message: `${field} is required`,
            data: null
          });
        }
      }

      const entity = new this.model(data);
      const savedEntity = await entity.save();

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: `${this.getEntityName()} created`,
        data: savedEntity
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          statusCode: 409,
          message: 'Category name already exists',
          data: null
        });
      }

      console.error(`Create ${this.getEntityName()} error:`, error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Override update để không filter theo user_id
  async update(req, res) {
    try {
      const updated = await this.model.findOneAndUpdate(
        { _id: req.params.id },
        req.body,
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: `${this.getEntityName()} not found`,
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `${this.getEntityName()} updated`,
        data: updated
      });
    } catch (error) {
      console.error(`Update ${this.getEntityName()} error:`, error);
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
      const deleted = await this.model.findOneAndDelete({ _id: req.params.id });
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: `${this.getEntityName()} not found`,
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `${this.getEntityName()} deleted`,
        data: null
      });
    } catch (error) {
      console.error(`Delete ${this.getEntityName()} error:`, error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
}

const categoryController = new CategoryController();

module.exports = {
  createCategory: categoryController.create.bind(categoryController),
  getAllCategories: categoryController.getAll.bind(categoryController),
  updateCategory: categoryController.update.bind(categoryController),
  deleteCategory: categoryController.delete.bind(categoryController)
};