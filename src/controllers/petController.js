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

  async getPetsByBreed(req, res) {
    try {
      const { breedId } = req.params;
      const {
        sortBy = 'created_at',
        sortOrder = 'desc',
        page = 1,
        limit = 10,
        status = 'available',
        minPrice,
        maxPrice
      } = req.query;

      const breed = await mongoose.model('Breed').findById(breedId);
      if (!breed) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Breed not found',
          data: null
        });
      }

      const filter = { breed_id: breedId };
      
      if (status) {
        filter.status = status;
      }

      if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
      }

      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const skip = (Number(page) - 1) * Number(limit);

      const pets = await this.model.find(filter)
        .populate('breed_id', 'name description category_id')
        .populate({
          path: 'breed_id',
          populate: {
            path: 'category_id',
            select: 'name description'
          }
        })
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean();

      const totalCount = await this.model.countDocuments(filter);

      if (this.imageModel) {
        for (let pet of pets) {
          const images = await this.imageModel.find({ [this.getImageForeignKey()]: pet._id }).lean();
          pet.images = images;
        }
      }

      const totalPages = Math.ceil(totalCount / Number(limit));
      const hasNextPage = Number(page) < totalPages;
      const hasPrevPage = Number(page) > 1;

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Pets of breed "${breed.name}" retrieved successfully`,
        data: {
          breed: breed,
          pets,
          pagination: {
            currentPage: Number(page),
            totalPages,
            totalCount,
            hasNextPage,
            hasPrevPage,
            limit: Number(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get pets by breed error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getPetsByCategory(req, res) {
    try {
      const { categoryId } = req.params;
      const {
        sortBy = 'created_at',
        sortOrder = 'desc',
        page = 1,
        limit = 10,
        status = 'available',
        breedId, 
        minPrice,
        maxPrice
      } = req.query;

      const category = await mongoose.model('Category').findById(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Category not found',
          data: null
        });
      }

      let breedFilter = { category_id: categoryId };
      if (breedId) {
        breedFilter._id = breedId;
      }

      const breeds = await mongoose.model('Breed').find(breedFilter).select('_id');
      const breedIds = breeds.map(breed => breed._id);

      if (breedIds.length === 0) {
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: `No breeds found in category "${category.name}"`,
          data: {
            category,
            pets: [],
            pagination: {
              currentPage: Number(page),
              totalPages: 0,
              totalCount: 0,
              hasNextPage: false,
              hasPrevPage: false,
              limit: Number(limit)
            }
          }
        });
      }

      const filter = { breed_id: { $in: breedIds } };
      
      if (status) {
        filter.status = status;
      }

      if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
      }

      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const skip = (Number(page) - 1) * Number(limit);

      const pets = await this.model.find(filter)
        .populate('breed_id', 'name description category_id')
        .populate({
          path: 'breed_id',
          populate: {
            path: 'category_id',
            select: 'name description'
          }
        })
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean();

      const totalCount = await this.model.countDocuments(filter);

      if (this.imageModel) {
        for (let pet of pets) {
          const images = await this.imageModel.find({ [this.getImageForeignKey()]: pet._id }).lean();
          pet.images = images;
        }
      }

      const availableBreeds = await mongoose.model('Breed').find({ category_id: categoryId })
        .select('_id name description');

      const totalPages = Math.ceil(totalCount / Number(limit));
      const hasNextPage = Number(page) < totalPages;
      const hasPrevPage = Number(page) > 1;

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Pets in category "${category.name}" retrieved successfully`,
        data: {
          category,
          availableBreeds,
          pets,
          pagination: {
            currentPage: Number(page),
            totalPages,
            totalCount,
            hasNextPage,
            hasPrevPage,
            limit: Number(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get pets by category error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getBreedStatistics(req, res) {
    try {
      const { breedId } = req.params;

      const breed = await mongoose.model('Breed').findById(breedId)
        .populate('category_id', 'name');
      
      if (!breed) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Breed not found',
          data: null
        });
      }

      const stats = await this.model.aggregate([
        { $match: { breed_id: new mongoose.Types.ObjectId(breedId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgPrice: { $avg: '$price' },
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            avgAge: { $avg: '$age' },
            avgWeight: { $avg: '$weight' }
          }
        }
      ]);

      const genderStats = await this.model.aggregate([
        { $match: { breed_id: new mongoose.Types.ObjectId(breedId) } },
        {
          $group: {
            _id: '$gender',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalCount = await this.model.countDocuments({ breed_id: breedId });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Breed statistics retrieved successfully',
        data: {
          breed,
          totalPets: totalCount,
          statusDistribution: stats,
          genderDistribution: genderStats
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

    async searchPetsByCategory(req, res) {
    try {
      const {
        keyword,          
        categoryIds,     
        breedIds,      
        minPrice,
        maxPrice,
        minAge,
        maxAge,
        minWeight,
        maxWeight,
        gender,
        status = 'available',
        type,             
        sortBy = 'created_at',
        sortOrder = 'desc',
        page = 1,
        limit = 12,
        includeStats = false  
      } = req.query;

      const categoryIdArray = categoryIds ? 
        (Array.isArray(categoryIds) ? categoryIds : categoryIds.split(',')) : [];
      const breedIdArray = breedIds ? 
        (Array.isArray(breedIds) ? breedIds : breedIds.split(',')) : [];

      let breedFilter = {};
      let petFilter = {};

      // 1. Filter breeds by categories nếu có
      if (categoryIdArray.length > 0) {
        breedFilter.category_id = { $in: categoryIdArray.map(id => new mongoose.Types.ObjectId(id)) };
      }

      if (keyword) {
        breedFilter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } }
        ];
      }

      let validBreedIds = [];
      if (Object.keys(breedFilter).length > 0 || breedIdArray.length > 0) {
        if (breedIdArray.length > 0) {
          breedFilter._id = { $in: breedIdArray.map(id => new mongoose.Types.ObjectId(id)) };
        }
        
        const breeds = await mongoose.model('Breed').find(breedFilter).select('_id');
        validBreedIds = breeds.map(breed => breed._id);

        if (validBreedIds.length === 0) {
          return res.status(200).json({
            success: true,
            statusCode: 200,
            message: 'No pets found matching the criteria',
            data: {
              pets: [],
              pagination: {
                currentPage: Number(page),
                totalPages: 0,
                totalCount: 0,
                hasNextPage: false,
                hasPrevPage: false,
                limit: Number(limit)
              },
              filters: { keyword, categoryIds: categoryIdArray, breedIds: breedIdArray }
            }
          });
        }

        petFilter.breed_id = { $in: validBreedIds };
      }

      if (keyword && !Object.keys(breedFilter).length) {
        petFilter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } }
        ];
      }

      if (type) {
        petFilter.type = { $regex: type, $options: 'i' };
      }

      if (gender) {
        petFilter.gender = gender;
      }

      if (status) {
        petFilter.status = status;
      }

      if (minPrice || maxPrice) {
        petFilter.price = {};
        if (minPrice) petFilter.price.$gte = Number(minPrice);
        if (maxPrice) petFilter.price.$lte = Number(maxPrice);
      }

      if (minAge || maxAge) {
        petFilter.age = {};
        if (minAge) petFilter.age.$gte = Number(minAge);
        if (maxAge) petFilter.age.$lte = Number(maxAge);
      }

      if (minWeight || maxWeight) {
        petFilter.weight = {};
        if (minWeight) petFilter.weight.$gte = Number(minWeight);
        if (maxWeight) petFilter.weight.$lte = Number(maxWeight);
      }

      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const skip = (Number(page) - 1) * Number(limit);

      const pets = await this.model.find(petFilter)
        .populate({
          path: 'breed_id',
          select: 'name description category_id',
          populate: {
            path: 'category_id',
            select: 'name description'
          }
        })
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean();

      const totalCount = await this.model.countDocuments(petFilter);

      if (this.imageModel) {
        for (let pet of pets) {
          const images = await this.imageModel.find({ 
            [this.getImageForeignKey()]: pet._id 
          }).lean();
          pet.images = images;
        }
      }

      const totalPages = Math.ceil(totalCount / Number(limit));
      const hasNextPage = Number(page) < totalPages;
      const hasPrevPage = Number(page) > 1;

      let statistics = null;
      if (includeStats === 'true') {
        statistics = await this.getCategorySearchStatistics(petFilter);
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Category search completed successfully',
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
            categoryIds: categoryIdArray,
            breedIds: breedIdArray,
            priceRange: { min: minPrice, max: maxPrice },
            ageRange: { min: minAge, max: maxAge },
            weightRange: { min: minWeight, max: maxWeight },
            gender,
            status,
            type
          },
          statistics
        }
      });

    } catch (error) {
      console.error('Category search error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getCategorySearchStatistics(petFilter) {
    try {
      const stats = await this.model.aggregate([
        { $match: petFilter },
        {
          $group: {
            _id: null,
            totalPets: { $sum: 1 },
            avgPrice: { $avg: '$price' },
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            avgAge: { $avg: '$age' },
            avgWeight: { $avg: '$weight' }
          }
        }
      ]);

      const categoryStats = await this.model.aggregate([
        { $match: petFilter },
        {
          $lookup: {
            from: 'breeds',
            localField: 'breed_id',
            foreignField: '_id',
            as: 'breed'
          }
        },
        { $unwind: '$breed' },
        {
          $lookup: {
            from: 'categories',
            localField: 'breed.category_id',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: '$category' },
        {
          $group: {
            _id: '$category._id',
            categoryName: { $first: '$category.name' },
            count: { $sum: 1 },
            avgPrice: { $avg: '$price' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      const breedStats = await this.model.aggregate([
        { $match: petFilter },
        {
          $lookup: {
            from: 'breeds',
            localField: 'breed_id',
            foreignField: '_id',
            as: 'breed'
          }
        },
        { $unwind: '$breed' },
        {
          $group: {
            _id: '$breed._id',
            breedName: { $first: '$breed.name' },
            count: { $sum: 1 },
            avgPrice: { $avg: '$price' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      return {
        overview: stats[0] || {
          totalPets: 0,
          avgPrice: 0,
          minPrice: 0,
          maxPrice: 0,
          avgAge: 0,
          avgWeight: 0
        },
        byCategory: categoryStats,
        topBreeds: breedStats
      };
    } catch (error) {
      console.error('Get statistics error:', error);
      return null;
    }
  }

  async getTrendingCategories(req, res) {
    try {
      const { 
        days = 30,           // Tính trend trong X ngày qua
        limit = 5,           // Top X categories
        includeStats = true  
      } = req.query;

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - Number(days));

      // Get categories with most pets added recently
      const trendingCategories = await this.model.aggregate([
        {
          $match: {
            created_at: { $gte: daysAgo },
            status: 'available'
          }
        },
        {
          $lookup: {
            from: 'breeds',
            localField: 'breed_id',
            foreignField: '_id',
            as: 'breed'
          }
        },
        { $unwind: '$breed' },
        {
          $lookup: {
            from: 'categories',
            localField: 'breed.category_id',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: '$category' },
        {
          $group: {
            _id: '$category._id',
            categoryName: { $first: '$category.name' },
            categoryDescription: { $first: '$category.description' },
            newPetsCount: { $sum: 1 },
            avgPrice: { $avg: '$price' },
            priceRange: {
              $push: '$price'
            }
          }
        },
        {
          $addFields: {
            minPrice: { $min: '$priceRange' },
            maxPrice: { $max: '$priceRange' }
          }
        },
        {
          $project: {
            priceRange: 0
          }
        },
        { $sort: { newPetsCount: -1 } },
        { $limit: Number(limit) }
      ]);

      // Get additional stats if requested
      let additionalStats = {};
      if (includeStats === 'true') {
        for (let category of trendingCategories) {
          // Get total pets in category (all time)
          const totalPets = await this.model.aggregate([
            {
              $lookup: {
                from: 'breeds',
                localField: 'breed_id',
                foreignField: '_id',
                as: 'breed'
              }
            },
            { $unwind: '$breed' },
            {
              $match: {
                'breed.category_id': category._id
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                available: {
                  $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
                }
              }
            }
          ]);

          category.totalPets = totalPets[0]?.total || 0;
          category.availablePets = totalPets[0]?.available || 0;
        }
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Top ${limit} trending categories in last ${days} days`,
        data: {
          trendingCategories,
          period: {
            days: Number(days),
            from: daysAgo,
            to: new Date()
          }
        }
      });

    } catch (error) {
      console.error('Get trending categories error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async compareCategories(req, res) {
    try {
      const { categoryIds } = req.body;

      if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length < 2) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Please provide at least 2 category IDs to compare',
          data: null
        });
      }

      if (categoryIds.length > 5) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Maximum 5 categories can be compared at once',
          data: null
        });
      }

      const comparison = [];

      for (let categoryId of categoryIds) {
        // Validate category exists
        const category = await mongoose.model('Category').findById(categoryId);
        if (!category) {
          return res.status(404).json({
            success: false,
            statusCode: 404,
            message: `Category with ID ${categoryId} not found`,
            data: null
          });
        }

        // Get breeds in this category
        const breeds = await mongoose.model('Breed').find({ 
          category_id: categoryId 
        }).select('_id name');

        const breedIds = breeds.map(breed => breed._id);

        // Get pets statistics
        const stats = await this.model.aggregate([
          {
            $match: {
              breed_id: { $in: breedIds }
            }
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              avgPrice: { $avg: '$price' },
              minPrice: { $min: '$price' },
              maxPrice: { $max: '$price' }
            }
          }
        ]);

        // Overall stats
        const overallStats = await this.model.aggregate([
          {
            $match: {
              breed_id: { $in: breedIds }
            }
          },
          {
            $group: {
              _id: null,
              totalPets: { $sum: 1 },
              avgPrice: { $avg: '$price' },
              minPrice: { $min: '$price' },
              maxPrice: { $max: '$price' },
              avgAge: { $avg: '$age' },
              avgWeight: { $avg: '$weight' }
            }
          }
        ]);

        // Price distribution
        const priceDistribution = await this.model.aggregate([
          {
            $match: {
              breed_id: { $in: breedIds }
            }
          },
          {
            $bucket: {
              groupBy: '$price',
              boundaries: [0, 1000000, 3000000, 5000000, 10000000, Infinity],
              default: 'Other',
              output: {
                count: { $sum: 1 },
                avgPrice: { $avg: '$price' }
              }
            }
          }
        ]);

        comparison.push({
          category: {
            _id: category._id,
            name: category.name,
            description: category.description
          },
          breeds: breeds,
          statistics: {
            byStatus: stats,
            overall: overallStats[0] || {},
            priceDistribution
          }
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Category comparison completed successfully',
        data: {
          comparison,
          comparedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Compare categories error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getCategoryInsights(req, res) {
    try {
      const { categoryId } = req.params;

      // Validate category
      const category = await mongoose.model('Category').findById(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Category not found',
          data: null
        });
      }

      // Get all breeds in category
      const breeds = await mongoose.model('Breed').find({ 
        category_id: categoryId 
      }).select('_id name description');

      const breedIds = breeds.map(breed => breed._id);

      // 1. Popular breeds trong category
      const popularBreeds = await this.model.aggregate([
        { $match: { breed_id: { $in: breedIds } } },
        {
          $group: {
            _id: '$breed_id',
            count: { $sum: 1 },
            avgPrice: { $avg: '$price' },
            availableCount: {
              $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
            }
          }
        },
        {
          $lookup: {
            from: 'breeds',
            localField: '_id',
            foreignField: '_id',
            as: 'breed'
          }
        },
        { $unwind: '$breed' },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $project: {
            breedName: '$breed.name',
            breedDescription: '$breed.description',
            totalPets: '$count',
            availablePets: '$availableCount',
            avgPrice: '$avgPrice'
          }
        }
      ]);

      // 2. Price trends
      const priceAnalysis = await this.model.aggregate([
        { $match: { breed_id: { $in: breedIds } } },
        {
          $group: {
            _id: {
              year: { $year: '$created_at' },
              month: { $month: '$created_at' }
            },
            avgPrice: { $avg: '$price' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 } // Last 12 months
      ]);

      // 3. Age và weight distribution
      const physicalStats = await this.model.aggregate([
        { $match: { breed_id: { $in: breedIds } } },
        {
          $group: {
            _id: null,
            avgAge: { $avg: '$age' },
            minAge: { $min: '$age' },
            maxAge: { $max: '$age' },
            avgWeight: { $avg: '$weight' },
            minWeight: { $min: '$weight' },
            maxWeight: { $max: '$weight' },
            ageDistribution: { $push: '$age' },
            weightDistribution: { $push: '$weight' }
          }
        }
      ]);

      // 4. Recommendations
      const recommendations = [];

      // Recommend based on popularity
      if (popularBreeds.length > 0) {
        const topBreed = popularBreeds[0];
        recommendations.push({
          type: 'popular_breed',
          title: `Most Popular: ${topBreed.breedName}`,
          description: `${topBreed.breedName} is the most popular breed in ${category.name} with ${topBreed.totalPets} pets`,
          data: topBreed
        });
      }

      // Recommend based on price
      const affordableBreeds = popularBreeds.filter(breed => breed.avgPrice < 3000000);
      if (affordableBreeds.length > 0) {
        recommendations.push({
          type: 'affordable_option',
          title: 'Budget-Friendly Options',
          description: 'These breeds offer great value in this category',
          data: affordableBreeds.slice(0, 3)
        });
      }

      // Recommend available pets
      const availableBreeds = popularBreeds.filter(breed => breed.availablePets > 0);
      if (availableBreeds.length > 0) {
        recommendations.push({
          type: 'available_now',
          title: 'Available Now',
          description: 'Breeds with pets currently available for adoption',
          data: availableBreeds
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Category insights retrieved successfully',
        data: {
          category,
          totalBreeds: breeds.length,
          insights: {
            popularBreeds,
            priceAnalysis,
            physicalStats: physicalStats[0] || {},
            recommendations
          },
          generatedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Get category insights error:', error);
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
  getFilterOptions: petController.getFilterOptions.bind(petController),

  //new 
  getPetsByBreed: petController.getPetsByBreed.bind(petController),
  getPetsByCategory: petController.getPetsByCategory.bind(petController),
  getBreedStatistics: petController.getBreedStatistics.bind(petController),

  //searchPetsByCategory
  searchPetsByCategory: petController.searchPetsByCategory.bind(petController),
  getTrendingCategories: petController.getTrendingCategories.bind(petController),
  compareCategories: petController.compareCategories.bind(petController),
  getCategoryInsights: petController.getCategoryInsights.bind(petController)
};