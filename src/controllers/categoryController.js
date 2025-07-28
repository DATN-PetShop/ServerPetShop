// src/controllers/categoryController.js
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

  // ✅ FIXED: Complete create method
  async create(req, res) {
    try {
      const requiredFields = this.getRequiredFields();
      const data = { ...req.body }; 

      // Validate required fields
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

      // Create new category
      const entity = new this.model(data);
      const savedEntity = await entity.save();

      // Handle image uploads if any
      if (this.imageModel && req.files && req.files.length > 0) {
        const imageDocs = req.files.map((file, index) => ({
          url: file.path, // Cloudinary URL
          is_primary: index === 0, 
          [this.getImageForeignKey()]: savedEntity._id
        }));
        
        await this.imageModel.insertMany(imageDocs);
        
        // Fetch images to include in response
        const images = await this.imageModel.find({ 
          [this.getImageForeignKey()]: savedEntity._id 
        }).lean();
        savedEntity.images = images;
      }

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: `${this.getEntityName()} created successfully`,
        data: savedEntity
      });
    } catch (error) {
      // Handle duplicate key error (unique constraint)
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

  // ✅ FIXED: Override update method to work without user_id constraint
  async update(req, res) {
    try {
      const { cloudinary } = require('../config/cloudinaryConfig');
      
      const updated = await this.model.findByIdAndUpdate(
        req.params.id, // No user_id constraint for categories
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

      // Handle new images if uploaded
      if (this.imageModel && req.files && req.files.length > 0) {
        // Get old images to delete from Cloudinary
        const oldImages = await this.imageModel.find({ [this.getImageForeignKey()]: updated._id });
        
        // Delete old images from Cloudinary
        if (oldImages.length > 0) {
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

        // Delete old image records from database
        await this.imageModel.deleteMany({ [this.getImageForeignKey()]: updated._id });

        // Add new images
        const imageDocs = req.files.map((file, index) => ({
          url: file.path, // Cloudinary URL
          is_primary: index === 0,
          [this.getImageForeignKey()]: updated._id
        }));
        
        await this.imageModel.insertMany(imageDocs);
        
        // Include images in response
        const images = await this.imageModel.find({ 
          [this.getImageForeignKey()]: updated._id 
        }).lean();
        updated.images = images;
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `${this.getEntityName()} updated successfully`,
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

  // ✅ FIXED: Override delete method to work without user_id constraint
  async delete(req, res) {
    try {
      const { cloudinary } = require('../config/cloudinaryConfig');
      
      const deleted = await this.model.findByIdAndDelete(req.params.id); // No user_id constraint
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: `${this.getEntityName()} not found`,
          data: null
        });
      }

      // Delete related images from Cloudinary and database
      if (this.imageModel) {
        const imagesToDelete = await this.imageModel.find({ [this.getImageForeignKey()]: deleted._id });
        
        // Delete images from Cloudinary
        if (imagesToDelete.length > 0) {
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

        await this.imageModel.deleteMany({ [this.getImageForeignKey()]: deleted._id });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `${this.getEntityName()} deleted successfully`,
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

  // ✅ Helper method to extract public_id from Cloudinary URL
  extractPublicIdFromUrl(url) {
    try {
      const parts = url.split('/');
      const uploadIndex = parts.indexOf('upload');
      if (uploadIndex !== -1 && uploadIndex + 2 < parts.length) {
        const publicIdWithExt = parts.slice(uploadIndex + 2).join('/');
        return publicIdWithExt.split('.')[0]; // Remove file extension
      }
      return null;
    } catch (error) {
      console.error('Error extracting public_id:', error);
      return null;
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