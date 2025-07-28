// src/controllers/breedController.js - Enhanced version
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

  // Lấy tất cả breeds với pagination và populate
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

  // Lấy breeds theo category với pagination
  async getBreedsByCategory(req, res) {
    try {
      const { categoryId } = req.params;
      const { page = 1, limit = 10, search } = req.query;

      // Validate category exists
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Category not found',
          data: null
        });
      }

      // Build filter
      const filter = { category_id: categoryId };
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [breeds, totalCount] = await Promise.all([
        this.model
          .find(filter)
          .populate('category_id', 'name description')
          .sort({ name: 1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        this.model.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(totalCount / Number(limit));

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Breeds by category retrieved successfully',
        data: {
          category: category,
          breeds,
          pagination: {
            currentPage: Number(page),
            totalPages,
            totalCount,
            hasNextPage: Number(page) < totalPages,
            hasPrevPage: Number(page) > 1,
            limit: Number(limit)
          }
        }
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

  // Lấy breed theo ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      const breed = await this.model
        .findById(id)
        .populate('category_id', 'name description')
        .lean();

      if (!breed) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Breed not found',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Breed retrieved successfully',
        data: breed
      });
    } catch (error) {
      console.error('Get breed by ID error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Tạo breed mới
  async create(req, res) {
    try {
      const { name, description, category_id } = req.body;

      // Validate required fields
      const requiredFields = this.getRequiredFields();
      for (const field of requiredFields) {
        if (!req.body[field]) {
          return res.status(400).json({
            success: false,
            statusCode: 400,
            message: `${field} is required`,
            data: null
          });
        }
      }

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

      // Check if breed name already exists in this category
      const existingBreed = await this.model.findOne({ 
        name: { $regex: `^${name}$`, $options: 'i' }, 
        category_id 
      });

      if (existingBreed) {
        return res.status(409).json({
          success: false,
          statusCode: 409,
          message: 'Breed name already exists in this category',
          data: null
        });
      }

      // Create new breed
      const newBreed = new this.model({
        name: name.trim(),
        description: description ? description.trim() : '',
        category_id
      });

      const savedBreed = await newBreed.save();
      
      // Populate category info
      const populatedBreed = await this.model
        .findById(savedBreed._id)
        .populate('category_id', 'name description')
        .lean();

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Breed created successfully',
        data: populatedBreed
      });
    } catch (error) {
      console.error('Create breed error:', error);
      
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          statusCode: 409,
          message: 'Breed name already exists',
          data: null
        });
      }

      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Cập nhật breed
  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, description, category_id } = req.body;

      // Check if breed exists
      const existingBreed = await this.model.findById(id);
      if (!existingBreed) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Breed not found',
          data: null
        });
      }

      // Validate category if provided
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

      // Check for duplicate name in the same category (excluding current breed)
      if (name && category_id) {
        const duplicateBreed = await this.model.findOne({
          _id: { $ne: id },
          name: { $regex: `^${name}$`, $options: 'i' },
          category_id
        });

        if (duplicateBreed) {
          return res.status(409).json({
            success: false,
            statusCode: 409,
            message: 'Breed name already exists in this category',
            data: null
          });
        }
      }

      // Update breed
      const updateData = {};
      if (name) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description.trim();
      if (category_id) updateData.category_id = category_id;
      updateData.updated_at = new Date();

      const updatedBreed = await this.model
        .findByIdAndUpdate(id, updateData, { new: true })
        .populate('category_id', 'name description')
        .lean();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Breed updated successfully',
        data: updatedBreed
      });
    } catch (error) {
      console.error('Update breed error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Xóa breed
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Check if breed exists
      const breed = await this.model.findById(id);
      if (!breed) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Breed not found',
          data: null
        });
      }

      // TODO: Check if breed is being used by any pets
      // const Pet = require('../models/Pet');
      // const petCount = await Pet.countDocuments({ breed_id: id });
      // if (petCount > 0) {
      //   return res.status(400).json({
      //     success: false,
      //     statusCode: 400,
      //     message: `Cannot delete breed. It is being used by ${petCount} pet(s)`,
      //     data: null
      //   });
      // }

      await this.model.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Breed deleted successfully',
        data: null
      });
    } catch (error) {
      console.error('Delete breed error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Thống kê breeds
  async getStatistics(req, res) {
    try {
      const stats = await this.model.aggregate([
        {
          $group: {
            _id: '$category_id',
            count: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category'
          }
        },
        {
          $unwind: '$category'
        },
        {
          $project: {
            category_name: '$category.name',
            count: 1
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      const totalBreeds = await this.model.countDocuments();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Breed statistics retrieved successfully',
        data: {
          totalBreeds,
          byCategory: stats
        }
      });
    } catch (error) {
      console.error('Get breed statistics error:', error);
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
  getBreedStatistics: breedController.getStatistics.bind(breedController)
};