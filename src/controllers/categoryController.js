const Category = require('../models/Category');
const CategoryImage = require('../models/CategoryImage');
const BaseCrudController = require('./baseCrudController');

class CategoryController extends BaseCrudController {
  constructor() {
    super(Category, CategoryImage); 
  }

  getRequiredFields() {
    return ['name'];
  }

  getEntityName() {
    return 'Category';
  }

  getImageForeignKey() {
    return 'category_id';
  }

  async getAll(req, res) {
    try {
      const categories = await this.model.find().lean();
      
      if (this.imageModel) {
        for (let category of categories) {
          const images = await this.imageModel.find({ 
            [this.getImageForeignKey()]: category._id 
          }).lean();
          category.images = images;
        }
      }

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

  async create(req, res) {
    try {
      const requiredFields = this.getRequiredFields();
      const data = { ...req.body }; 

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

      if (this.imageModel && req.files && req.files.length > 0) {
        const imageDocs = req.files.map((file, index) => ({
          url: file.path, 
          is_primary: index === 0, 
          [this.getImageForeignKey()]: savedEntity._id
        }));
        
        await this.imageModel.insertMany(imageDocs);
        
        const images = await this.imageModel.find({ 
          [this.getImageForeignKey()]: savedEntity._id 
        }).lean();
        savedEntity.images = images;
      }

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
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

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

      if (this.imageModel && req.files && req.files.length > 0) {
        const oldImages = await this.imageModel.find({ 
          [this.getImageForeignKey()]: updated._id 
        });
        
        if (oldImages.length > 0) {
          const { cloudinary } = require('../config/cloudinaryConfig');
          const deletePromises = oldImages.map(async (img) => {
            try {
              const publicId = this.extractPublicIdFromUrl(img.url);
              if (publicId) {
                await cloudinary.uploader.destroy(publicId);
              }
            } catch (error) {
              console.error('Error deleting image from Cloudinary:', error);
            }
          });
          await Promise.allSettled(deletePromises);
        }

        await this.imageModel.deleteMany({ 
          [this.getImageForeignKey()]: updated._id 
        });

        const imageDocs = req.files.map((file, index) => ({
          url: file.path, 
          is_primary: index === 0, 
          [this.getImageForeignKey()]: updated._id
        }));
        
        await this.imageModel.insertMany(imageDocs);
      }

      if (this.imageModel) {
        const images = await this.imageModel.find({ 
          [this.getImageForeignKey()]: updated._id 
        }).lean();
        updated.images = images;
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

      if (this.imageModel) {
        const imagesToDelete = await this.imageModel.find({ 
          [this.getImageForeignKey()]: deleted._id 
        });
        
        if (imagesToDelete.length > 0) {
          const { cloudinary } = require('../config/cloudinaryConfig');
          const deletePromises = imagesToDelete.map(async (img) => {
            try {
              const publicId = this.extractPublicIdFromUrl(img.url);
              if (publicId) {
                await cloudinary.uploader.destroy(publicId);
              }
            } catch (error) {
              console.error('Error deleting image from Cloudinary:', error);
            }
          });
          await Promise.allSettled(deletePromises);
        }

        await this.imageModel.deleteMany({ 
          [this.getImageForeignKey()]: deleted._id 
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

  async getById(req, res) {
    try {
      const category = await this.model.findById(req.params.id).lean();

      if (!category) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Category not found',
          data: null
        });
      }

      if (this.imageModel) {
        const images = await this.imageModel.find({ 
          [this.getImageForeignKey()]: category._id 
        }).lean();
        category.images = images;
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Category retrieved successfully',
        data: category
      });
    } catch (error) {
      console.error('Get category by ID error:', error);
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
  getCategoryById: categoryController.getById.bind(categoryController),
  updateCategory: categoryController.update.bind(categoryController),
  deleteCategory: categoryController.delete.bind(categoryController)
};