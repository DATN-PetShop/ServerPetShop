const Pet = require('../models/Pet');
const Image = require('../models/ImagePet');
const BaseCrudController = require('./baseCrudController');
const mongoose = require('mongoose'); 

class PetController extends BaseCrudController {
  constructor() {
    super(Pet, Image);
  }

  getRequiredFields() {
    return ['name', 'price', 'type']; 
  }

  getEntityName() {
    return 'Pet';
  }

  getImageForeignKey() {
    return 'pet_id';
  }

  async getAllPetsPublic(req, res) {
    try {
      const pets = await this.model.find()
        .populate('breed_id', 'name description')
        // .populate('user_id', 'username email')
        .lean();

      // Populate images
      if (this.imageModel) {
        for (let pet of pets) {
          const images = await this.imageModel.find({ [this.getImageForeignKey()]: pet._id }).lean();
          pet.images = images;
        }
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'All pets retrieved successfully',
        data: pets
      });
    } catch (error) {
      console.error('Get all pets public error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getAllPetsAdmin(req, res) {
    try {
      const pets = await this.model.find()
        .populate('breed_id', 'name description')
        .populate('user_id', 'username email role')
        .lean();

      if (this.imageModel) {
        for (let pet of pets) {
          const images = await this.imageModel.find({ [this.getImageForeignKey()]: pet._id }).lean();
          pet.images = images;
        }
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'All pets for admin retrieved successfully',
        data: pets
      });
    } catch (error) {
      console.error('Get all pets admin error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async searchPets(req, res) {
    try {
      const {
        keyword,        // tìm theo tên
        type,          // loại thú cưng
        breed_id,      // giống
        gender,        // giới tính
        status,        // trạng thái
        minPrice,      // giá tối thiểu
        maxPrice,      // giá tối đa
        minAge,        // tuổi tối thiểu
        maxAge,        // tuổi tối đa
        minWeight,     // cân nặng tối thiểu
        maxWeight,     // cân nặng tối đa
        sortBy = 'created_at',  // sắp xếp theo
        sortOrder = 'desc',     // thứ tự sắp xếp
        page = 1,      // trang
        limit = 10     // số lượng mỗi trang
      } = req.query;

      // Xây dựng query filter
      const filter = {};

      // Tìm kiếm theo keyword (tên hoặc mô tả)
      if (keyword) {
        filter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } }
        ];
      }

      // Lọc theo type
      if (type) {
        filter.type = { $regex: type, $options: 'i' };
      }

      // Lọc theo breed_id
      if (breed_id) {
        filter.breed_id = breed_id;
      }

      // Lọc theo gender
      if (gender) {
        filter.gender = gender;
      }

      // Lọc theo status
      if (status) {
        filter.status = status;
      }

      // Lọc theo khoảng giá
      if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
      }

      // Lọc theo khoảng tuổi
      if (minAge || maxAge) {
        filter.age = {};
        if (minAge) filter.age.$gte = Number(minAge);
        if (maxAge) filter.age.$lte = Number(maxAge);
      }

      // Lọc theo khoảng cân nặng
      if (minWeight || maxWeight) {
        filter.weight = {};
        if (minWeight) filter.weight.$gte = Number(minWeight);
        if (maxWeight) filter.weight.$lte = Number(maxWeight);
      }

      // Xây dựng sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const skip = (Number(page) - 1) * Number(limit);

      const pets = await this.model.find(filter)
        .populate('breed_id', 'name description')
        .populate('user_id', 'username email')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean();

      // Đếm tổng số kết quả
      const totalCount = await this.model.countDocuments(filter);

      // Populate images cho mỗi pet
      if (this.imageModel) {
        for (let pet of pets) {
          const images = await this.imageModel.find({ [this.getImageForeignKey()]: pet._id }).lean();
          pet.images = images;
        }
      }

      // Tính toán thông tin pagination
      const totalPages = Math.ceil(totalCount / Number(limit));
      const hasNextPage = Number(page) < totalPages;
      const hasPrevPage = Number(page) > 1;

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Search completed successfully',
        data: {
          pets,
          pagination: {
            currentPage: Number(page),
            totalPages,
            totalCount,
            hasNextPage,
            hasPrevPage,
            limit: Number(limit)
          },
          filters: {
            keyword,
            type,
            breed_id,
            gender,
            status,
            priceRange: { min: minPrice, max: maxPrice },
            ageRange: { min: minAge, max: maxAge },
            weightRange: { min: minWeight, max: maxWeight }
          }
        }
      });

    } catch (error) {
      console.error('Search pets error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Tìm kiếm gợi ý (suggestions)
  async searchSuggestions(req, res) {
    try {
      const { keyword } = req.query;

      if (!keyword || keyword.length < 2) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Keyword must be at least 2 characters',
          data: null
        });
      }

      // Lấy gợi ý tên pets
      const petNames = await this.model.distinct('name', {
        name: { $regex: keyword, $options: 'i' }
      });

      // Lấy gợi ý types
      const types = await this.model.distinct('type', {
        type: { $regex: keyword, $options: 'i' }
      });

      // Lấy gợi ý breeds
      const breeds = await mongoose.model('Breed').find({
        name: { $regex: keyword, $options: 'i' }
      }).select('_id name').limit(5);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Suggestions retrieved successfully',
        data: {
          petNames: petNames.slice(0, 5),
          types: types.slice(0, 5),
          breeds: breeds
        }
      });

    } catch (error) {
      console.error('Search suggestions error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Lọc nâng cao
  async getFilterOptions(req, res) {
    try {
      // Lấy tất cả các options để hiển thị trong filter
      const types = await this.model.distinct('type');
      const genders = await this.model.distinct('gender');
      const statuses = await this.model.distinct('status');
      
      // Lấy khoảng giá
      const priceRange = await this.model.aggregate([
        {
          $group: {
            _id: null,
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' }
          }
        }
      ]);

      // Lấy khoảng tuổi
      const ageRange = await this.model.aggregate([
        {
          $group: {
            _id: null,
            minAge: { $min: '$age' },
            maxAge: { $max: '$age' }
          }
        }
      ]);

      // Lấy tất cả breeds
      const breeds = await mongoose.model('Breed').find()
        .select('_id name')
        .sort({ name: 1 });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Filter options retrieved successfully',
        data: {
          types,
          genders,
          statuses,
          breeds,
          priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 },
          ageRange: ageRange[0] || { minAge: 0, maxAge: 0 }
        }
      });

    } catch (error) {
      console.error('Get filter options error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
}

const petController = new PetController();

module.exports = {
  createPet: petController.create.bind(petController),
  getAllPetsPublic: petController.getAllPetsPublic.bind(petController),
  getAllPetsAdmin: petController.getAllPetsAdmin.bind(petController), 
  updatePet: petController.update.bind(petController),
  deletePet: petController.delete.bind(petController),
  // FIX
  searchPets: petController.searchPets.bind(petController),
  searchSuggestions: petController.searchSuggestions.bind(petController),
  getFilterOptions: petController.getFilterOptions.bind(petController)
};