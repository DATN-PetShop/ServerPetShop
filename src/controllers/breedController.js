const Breed = require('../models/Breed');
const Category = require('../models/Category');
const BreedImage = require('../models/BreedImage');
const BaseCrudController = require('./baseCrudController');
const { cloudinary } = require('../config/cloudinaryConfig');
const mongoose = require('mongoose');

class BreedController extends BaseCrudController {
  constructor() {
    super(Breed, BreedImage);
  }

  getRequiredFields() {
    return ['name', 'category_id'];
  }

  getEntityName() {
    return 'Breed';
  }

  getImageForeignKey() {
    return 'breed_id';
  }

  async getAll(req, res) {
    try {
      const breeds = await this.model.find().populate('category_id', 'name description').lean();

      // Thêm images cho mỗi breed
      if (this.imageModel) {
        for (let breed of breeds) {
          const images = await this.imageModel.find({
            [this.getImageForeignKey()]: breed._id
          }).lean();
          breed.images = images;
        }
      }

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

      // Thêm images cho mỗi breed
      if (this.imageModel) {
        for (let breed of breeds) {
          const images = await this.imageModel.find({
            [this.getImageForeignKey()]: breed._id
          }).lean();
          breed.images = images;
        }
      }

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

      // Validate category exists
      const category = await Category.findById(category_id);
      if (!category) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Category not found',
          data: null
        });
      }

      // Validate required fields
      const requiredFields = this.getRequiredFields();
      const data = { ...req.body }; // Không thêm user_id cho breed

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

      // Create breed
      const entity = new this.model(data);
      const savedEntity = await entity.save();

      // Handle image uploads if present
      if (this.imageModel && req.files && req.files.length > 0) {
        const imageDocs = req.files.map((file, index) => ({
          url: file.path, // Cloudinary URL
          is_primary: index === 0, // First image is primary
          [this.getImageForeignKey()]: savedEntity._id
        }));
        
        await this.imageModel.insertMany(imageDocs);
        
        // Attach images to response
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
      console.error('Create breed error:', error);
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
      const { category_id } = req.body;

      // Validate category exists if provided
      if (category_id) {
        const category = await Category.findById(category_id);
        if (!category) {
          return res.status(400).json({
            success: false,
            statusCode: 400,
            message: 'Category not found',
            data: null
          });
        }
      }

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

      // Handle image updates if present
      if (this.imageModel && req.files && req.files.length > 0) {
        // Delete old images from cloudinary
        const oldImages = await this.imageModel.find({
          [this.getImageForeignKey()]: updated._id
        });
        
        if (oldImages.length > 0) {
          // Delete from Cloudinary
          for (const image of oldImages) {
            const publicId = image.url.split('/').pop().split('.')[0];
            try {
              await cloudinary.uploader.destroy(`e-commerce/${publicId}`);
            } catch (cloudinaryError) {
              console.log('Error deleting from cloudinary:', cloudinaryError);
            }
          }
        }

        // Delete old image records
        await this.imageModel.deleteMany({
          [this.getImageForeignKey()]: updated._id
        });

        // Create new image records
        const imageDocs = req.files.map((file, index) => ({
          url: file.path, // Cloudinary URL
          is_primary: index === 0, // First image is primary
          [this.getImageForeignKey()]: updated._id
        }));
        
        await this.imageModel.insertMany(imageDocs);
      }

      // Attach images to response
      if (this.imageModel) {
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

      // Delete associated images
      if (this.imageModel) {
        const imagesToDelete = await this.imageModel.find({
          [this.getImageForeignKey()]: deleted._id
        });
        
        if (imagesToDelete.length > 0) {
          // Delete from Cloudinary
          for (const image of imagesToDelete) {
            const publicId = image.url.split('/').pop().split('.')[0];
            try {
              await cloudinary.uploader.destroy(`e-commerce/${publicId}`);
            } catch (cloudinaryError) {
              console.log('Error deleting from cloudinary:', cloudinaryError);
            }
          }

          // Delete image records
          await this.imageModel.deleteMany({
            [this.getImageForeignKey()]: deleted._id
          });
        }
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

  async getById(req, res) {
    try {
      const breed = await this.model.findById(req.params.id)
        .populate('category_id', 'name description')
        .lean();

      if (!breed) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: `${this.getEntityName()} not found`,
          data: null
        });
      }

      // Attach images
      if (this.imageModel) {
        const images = await this.imageModel.find({
          [this.getImageForeignKey()]: breed._id
        }).lean();
        breed.images = images;
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `${this.getEntityName()} retrieved successfully`,
        data: breed
      });
    } catch (error) {
      console.error(`Get ${this.getEntityName()} by ID error:`, error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
  // Tìm kiếm breed theo tên
  async searchBreedsByName(req, res) {
    try {
      const {
        keyword = '',          // Từ khóa tìm kiếm (tên breed)
        categoryId,            // Lọc theo category (optional)
        page = 1,              // Trang hiện tại
        limit = 10,            // Số lượng breed mỗi trang
        sortBy = 'name',       // Sắp xếp theo (name, created_at)
        sortOrder = 'asc',     // Thứ tự sắp xếp (asc, desc)
        includeStats = false,  // Có bao gồm thống kê pets không
        includeImages = true   // Có bao gồm ảnh không
      } = req.query;

      console.log('🔍 Breed Search API called with:', {
        keyword,
        categoryId,
        page,
        limit
      });

      // Xây dựng query filter
      const filter = {};

      // Tìm kiếm theo keyword (tên hoặc mô tả)
      if (keyword && keyword.trim()) {
        filter.$or = [
          { name: { $regex: keyword.trim(), $options: 'i' } },
          { description: { $regex: keyword.trim(), $options: 'i' } }
        ];
      }

      // Lọc theo category
      if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
        filter.category_id = categoryId;
      }

      console.log('📋 Filter applied:', filter);

      // Xây dựng sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Tính toán pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Thực hiện query
      const breeds = await this.model
        .find(filter)
        .populate('category_id', 'name description')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean();

      // Đếm tổng số breed
      const totalCount = await this.model.countDocuments(filter);
      const totalPages = Math.ceil(totalCount / Number(limit));
      const hasNextPage = Number(page) < totalPages;
      const hasPrevPage = Number(page) > 1;

      // Populate images nếu cần
      if (includeImages === 'true' && this.imageModel) {
        for (let breed of breeds) {
          const images = await this.imageModel
            .find({ [this.getImageForeignKey()]: breed._id })
            .lean();
          breed.images = images;
        }
      }

      // Thêm thống kê pets cho mỗi breed nếu cần
      if (includeStats === 'true') {
        const Pet = require('../models/Pet');
        
        for (let breed of breeds) {
          // Đếm tổng số pets
          const totalPets = await Pet.countDocuments({ breed_id: breed._id });
          
          // Đếm pets theo status
          const availablePets = await Pet.countDocuments({
            breed_id: breed._id,
            status: 'available'
          });
          
          const soldPets = await Pet.countDocuments({
            breed_id: breed._id,
            status: 'sold'
          });

          // Giá trung bình
          const avgPriceResult = await Pet.aggregate([
            { $match: { breed_id: breed._id } },
            { $group: { _id: null, avgPrice: { $avg: '$price' } } }
          ]);

          breed.stats = {
            totalPets,
            availablePets,
            soldPets,
            avgPrice: avgPriceResult.length > 0 ? Math.round(avgPriceResult[0].avgPrice) : 0
          };
        }
      }

      console.log(`✅ Found ${breeds.length} breeds`);

      // Response
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: keyword
          ? `Search completed for "${keyword}"`
          : 'All breeds retrieved successfully',
        data: {
          breeds,
          pagination: {
            currentPage: Number(page),
            totalPages,
            totalCount,
            hasNextPage,
            hasPrevPage,
            limit: Number(limit)
          },
          searchInfo: {
            keyword: keyword || '',
            categoryId: categoryId || null,
            resultsCount: breeds.length
          }
        }
      });

    } catch (error) {
      console.error('Breed search by name error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
  // Tìm kiếm có gợi ý breed theo tên
  async getBreedSearchSuggestions(req, res) {
    try {
      const { keyword = '', limit = 5 } = req.query;

      if (!keyword || keyword.trim().length < 2) {
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: 'Keyword too short for suggestions',
          data: {
            suggestions: [],
            keyword: keyword || ''
          }
        });
      }

      // Tìm breed suggestions
      const suggestions = await this.model
        .find({
          name: { $regex: keyword.trim(), $options: 'i' }
        })
        .select('name category_id')
        .populate('category_id', 'name')
        .limit(Number(limit))
        .lean();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Breed search suggestions retrieved successfully',
        data: {
          suggestions: suggestions.map(breed => ({
            _id: breed._id,
            name: breed.name,
            category: breed.category_id?.name || 'Unknown'
          })),
          keyword,
          totalSuggestions: suggestions.length
        }
      });

    } catch (error) {
      console.error('Get breed search suggestions error:', error);
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
  getBreedById: breedController.getById.bind(breedController),
  getBreedsByCategory: breedController.getBreedsByCategory.bind(breedController),
  updateBreed: breedController.update.bind(breedController),
  deleteBreed: breedController.delete.bind(breedController),
  searchBreedsByName: breedController.searchBreedsByName.bind(breedController),
  getBreedSearchSuggestions: breedController.getBreedSearchSuggestions.bind(breedController),
};