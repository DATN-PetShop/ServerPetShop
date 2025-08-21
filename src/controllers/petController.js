const Pet = require('../models/Pet');
const Image = require('../models/ImagePet');
const BaseCrudController = require('./baseCrudController');
const mongoose = require('mongoose');
const PetVariant = require('../models/PetVariant');
const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
class PetController extends BaseCrudController {
  constructor() {
    super(Pet, Image);
  }

// 1. Cập nhật getRequiredFields() method
getRequiredFields() {
  return ['name', 'type']; // Chỉ name và type là required
}
  getEntityName() {
    return 'Pet';
  }

  getImageForeignKey() {
    return 'pet_id';
  }

 async getAllPetsPublic(req, res) {
    const filter = { status: 'available' };  // Chỉ lấy pets có sẵn

    try {
        const pets = await this.model.find(filter)
            .populate('breed_id', 'name description')
            .lean();

        // Populate images and variants
        if (this.imageModel) {
            for (let pet of pets) {
                // Populate images
                const images = await this.imageModel.find({ [this.getImageForeignKey()]: pet._id }).lean();
                pet.images = images;

                // Populate variants
                const variants = await PetVariant.find({ 
                    pet_id: pet._id, 
                    is_available: true 
                }).lean();

                // Tính final price cho mỗi variant
                const variantsWithPrice = await Promise.all(
                    variants.map(async (variant) => {
                        const finalPrice = variant.price_adjustment; // Giả sử price_adjustment là giá cuối
                        return {
                            ...variant,
                            final_price: finalPrice,
                            display_name: `${variant.color} - ${variant.weight}kg - ${variant.gender} - ${variant.age} years`
                        };
                    })
                );

                pet.variants = variantsWithPrice;

                // Thêm variant options cho frontend filter
                if (variantsWithPrice.length > 0) {
                    const colors = [...new Set(variantsWithPrice.map(v => v.color))].sort();
                    const genders = [...new Set(variantsWithPrice.map(v => v.gender))].sort();
                    const ages = [...new Set(variantsWithPrice.map(v => v.age))].sort((a, b) => a - b);
                    const weights = [...new Set(variantsWithPrice.map(v => v.weight))].sort((a, b) => a - b);

                    pet.variant_options = {
                        colors,
                        genders,
                        age_range: { min: Math.min(...ages), max: Math.max(...ages) },
                        weight_range: { min: Math.min(...weights), max: Math.max(...weights) }
                    };
                } else {
                    pet.variants = []; // Đảm bảo có variants array ngay cả khi rỗng
                    pet.variant_options = {};
                }
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

// Thay thế method getAllPetsAdmin trong petController.js
async getAllPetsAdmin(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      search,
      type,
      status,
      breed_id,
      minPrice,
      maxPrice,
      age,
      gender
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (breed_id) filter.breed_id = breed_id;
    if (gender) filter.gender = gender;
    if (age) filter.age = age;
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Sort configuration
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Get pets with population
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

    // Get images for each pet
    if (this.imageModel) {
      for (let pet of pets) {
        const images = await this.imageModel.find({ [this.getImageForeignKey()]: pet._id }).lean();
        pet.images = images;
      }
    }

    // Get total count for pagination
    const totalCount = await this.model.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / Number(limit));

    // Calculate statistics
    const allPets = await this.model.find(filter).lean();
    const statistics = {
      totalPets: allPets.length,
      availablePets: allPets.filter(p => p.status === 'available').length,
      soldPets: allPets.filter(p => p.status === 'sold').length,
      reservedPets: allPets.filter(p => p.status === 'reserved').length,
      totalValue: allPets.reduce((sum, p) => sum + p.price, 0),
      averagePrice: allPets.length > 0 ? allPets.reduce((sum, p) => sum + p.price, 0) / allPets.length : 0
    };

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Pets retrieved successfully',
      data: {
        pets,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalCount,
          limit: Number(limit)
        },
        statistics
      }
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
      keyword,
      q,
      type,
      breed_id,
      gender,
      status = 'available',
      minPrice,
      maxPrice,
      minAge,
      maxAge,
      minWeight,
      maxWeight,
      sortBy = 'created_at',
      sortOrder = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    const searchTerm = keyword || q;

    console.log('🔍 Pet Search API called with:', {
      searchTerm,
      type,
      breed_id,
      gender,
      status,
      page,
      limit
    });

    // Xây dựng filter cho Pet
    const petFilter = {};
    if (searchTerm) {
      petFilter.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ];
    }
    if (type) petFilter.type = { $regex: type, $options: 'i' };
    if (breed_id) petFilter.breed_id = breed_id;
    if (gender) petFilter.gender = gender;
    if (status) petFilter.status = status;

    // Xây dựng filter cho Variant (giá, tuổi, cân nặng)
    const variantFilter = { is_available: true };
    const variantConditions = [];
    if (minPrice || maxPrice) {
      variantConditions.push({
        $expr: {
          $and: [
            minPrice ? { $gte: ['$final_price', Number(minPrice)] } : true,
            maxPrice ? { $lte: ['$final_price', Number(maxPrice)] } : true
          ]
        }
      });
    }
    if (minAge || maxAge) {
      variantConditions.push({
        $expr: {
          $and: [
            minAge ? { $gte: ['$age', Number(minAge)] } : true,
            maxAge ? { $lte: ['$age', Number(maxAge)] } : true
          ]
        }
      });
    }
    if (minWeight || maxWeight) {
      variantConditions.push({
        $expr: {
          $and: [
            minWeight ? { $gte: ['$weight', Number(minWeight)] } : true,
            maxWeight ? { $lte: ['$weight', Number(maxWeight)] } : true
          ]
        }
      });
    }

    // Aggregation pipeline
    const pipeline = [
      { $match: petFilter },
      {
        $lookup: {
          from: 'petvariants',
          localField: '_id',
          foreignField: 'pet_id',
          as: 'variants',
          pipeline: [
            { $match: variantFilter },
            ...variantConditions,
            {
              $project: {
                color: 1,
                weight: 1,
                gender: 1,
                age: 1,
                price_adjustment: 1,
                is_available: 1,
                final_price: { $ifNull: ['$selling_price', 0] }, // Sử dụng selling_price làm final_price
                display_name: {
                  $concat: [
                    '$color', ' - ', { $toString: '$weight' }, 'kg - ', '$gender', ' - ', { $toString: '$age' }, ' years'
                  ]
                }
              }
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'imagepets',
          localField: '_id',
          foreignField: 'pet_id',
          as: 'images'
        }
      },
      {
        $match: {
          $expr: { $gt: [{ $size: '$variants' }, 0] } // Chỉ giữ pet có variant hợp lệ
        }
      },
      {
        $lookup: {
          from: 'breeds',
          localField: 'breed_id',
          foreignField: '_id',
          as: 'breed_id',
          pipeline: [{ $project: { name: 1, description: 1 } }]
        }
      },
      { $unwind: '$breed_id' },
      { $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 } },
      { $skip: (Number(page) - 1) * Number(limit) },
      { $limit: Number(limit) }
    ];

    const pets = await this.model.aggregate(pipeline).allowDiskUse(true);

    // Đếm tổng số kết quả
    const totalCount = await this.model.aggregate([
      { $match: petFilter },
      {
        $lookup: {
          from: 'petvariants',
          localField: '_id',
          foreignField: 'pet_id',
          as: 'variants',
          pipeline: [{ $match: variantFilter }, ...variantConditions]
        }
      },
      { $match: { $expr: { $gt: [{ $size: '$variants' }, 0] } } },
      { $count: 'total' }
    ]).then(results => results[0]?.total || 0);

    const totalPages = Math.ceil(totalCount / Number(limit));
    const hasNextPage = Number(page) < totalPages;
    const hasPrevPage = Number(page) > 1;

    console.log('✅ Pet Search Results:', {
      petsFound: pets.length,
      totalCount,
      currentPage: page,
      totalPages
    });

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
          keyword: searchTerm,
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

    // Validate breed ID
    if (!mongoose.Types.ObjectId.isValid(breedId)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Invalid breed ID format',
        data: null
      });
    }

    // Check if breed exists
    const breed = await mongoose.model('Breed').findById(breedId);
    if (!breed) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Breed not found',
        data: null
      });
    }

    // Build filter object
    const filter = { breed_id: breedId };

    if (status) {
      filter.status = status;
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Sort configuration
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Get pets with population
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

    // Get total count for pagination
    const totalCount = await this.model.countDocuments(filter);

    // Populate images and variants for each pet
    if (this.imageModel) {
      for (let pet of pets) {
        // Populate images
        const images = await this.imageModel.find({ [this.getImageForeignKey()]: pet._id }).lean();
        pet.images = images;

        // 🆕 Populate variants with price calculation
        const variants = await PetVariant.find({ 
          pet_id: pet._id, 
          is_available: true 
        }).lean();

        // Calculate final price for each variant
        const variantsWithPrice = await Promise.all(
          variants.map(async (variant) => {
            const finalPrice = pet.price + (variant.price_adjustment || 0);
            return {
              ...variant,
              final_price: finalPrice,
              display_name: `${variant.color} - ${variant.weight}kg - ${variant.gender} - ${variant.age} years`
            };
          })
        );

        pet.variants = variantsWithPrice;

        // 🆕 Calculate display price (show lowest variant price or base price)
        if (variantsWithPrice.length > 0) {
          const prices = variantsWithPrice.map(v => v.final_price);
          const minVariantPrice = Math.min(...prices);
          const maxVariantPrice = Math.max(...prices);
          
          // Set display price as the lowest variant price
          pet.display_price = minVariantPrice;
          pet.price_range = {
            min: minVariantPrice,
            max: maxVariantPrice,
            hasRange: minVariantPrice !== maxVariantPrice
          };
        } else {
          // No variants, use base price
          pet.display_price = pet.price;
          pet.price_range = {
            min: pet.price,
            max: pet.price,
            hasRange: false
          };
        }

        // Add variant options for frontend filter
        if (variantsWithPrice.length > 0) {
          const colors = [...new Set(variantsWithPrice.map(v => v.color))].sort();
          const genders = [...new Set(variantsWithPrice.map(v => v.gender))].sort();
          const ages = [...new Set(variantsWithPrice.map(v => v.age))].sort((a, b) => a - b);
          const weights = [...new Set(variantsWithPrice.map(v => v.weight))].sort((a, b) => a - b);

          pet.variant_options = {
            colors,
            genders,
            age_range: { min: Math.min(...ages), max: Math.max(...ages) },
            weight_range: { min: Math.min(...weights), max: Math.max(...weights) }
          };
        } else {
          pet.variants = [];
          pet.variant_options = {};
        }
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

// 🆕 Also update getAllPetsPublic to include display_price
async getAllPetsPublic(req, res) {
  const filter = { status: 'available' };

  try {
    const pets = await this.model.find(filter)
      .populate('breed_id', 'name description')
      .lean();

    // Populate images and variants
    if (this.imageModel) {
      for (let pet of pets) {
        // Populate images
        const images = await this.imageModel.find({ [this.getImageForeignKey()]: pet._id }).lean();
        pet.images = images;

        // Populate variants
        const variants = await PetVariant.find({ 
          pet_id: pet._id, 
          is_available: true 
        }).lean();

        // Calculate final price for each variant
        const variantsWithPrice = await Promise.all(
          variants.map(async (variant) => {
            const finalPrice = pet.price + (variant.price_adjustment || 0);
            return {
              ...variant,
              final_price: finalPrice,
              display_name: `${variant.color} - ${variant.weight}kg - ${variant.gender} - ${variant.age} years`
            };
          })
        );

        pet.variants = variantsWithPrice;

        // 🆕 Calculate display price
        if (variantsWithPrice.length > 0) {
          const prices = variantsWithPrice.map(v => v.final_price);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          
          pet.display_price = minPrice;
          pet.price_range = {
            min: minPrice,
            max: maxPrice,
            hasRange: minPrice !== maxPrice
          };

          // Add variant options for frontend filter
          const colors = [...new Set(variantsWithPrice.map(v => v.color))].sort();
          const genders = [...new Set(variantsWithPrice.map(v => v.gender))].sort();
          const ages = [...new Set(variantsWithPrice.map(v => v.age))].sort((a, b) => a - b);
          const weights = [...new Set(variantsWithPrice.map(v => v.weight))].sort((a, b) => a - b);

          pet.variant_options = {
            colors,
            genders,
            age_range: { min: Math.min(...ages), max: Math.max(...ages) },
            weight_range: { min: Math.min(...weights), max: Math.max(...weights) }
          };
        } else {
          pet.display_price = pet.price;
          pet.price_range = {
            min: pet.price,
            max: pet.price,
            hasRange: false
          };
          pet.variants = [];
          pet.variant_options = {};
        }
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
        days = 30,
        limit = 5,
        includeStats = true
      } = req.query;

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - Number(days));

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

      let additionalStats = {};
      if (includeStats === 'true') {
        for (let category of trendingCategories) {
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
        const category = await mongoose.model('Category').findById(categoryId);
        if (!category) {
          return res.status(404).json({
            success: false,
            statusCode: 404,
            message: `Category with ID ${categoryId} not found`,
            data: null
          });
        }

        const breeds = await mongoose.model('Breed').find({
          category_id: categoryId
        }).select('_id name');

        const breedIds = breeds.map(breed => breed._id);

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

      const category = await mongoose.model('Category').findById(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Category not found',
          data: null
        });
      }

      const breeds = await mongoose.model('Breed').find({
        category_id: categoryId
      }).select('_id name description');

      const breedIds = breeds.map(breed => breed._id);

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
        { $limit: 12 }
      ]);

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

      const recommendations = [];

      if (popularBreeds.length > 0) {
        const topBreed = popularBreeds[0];
        recommendations.push({
          type: 'popular_breed',
          title: `Most Popular: ${topBreed.breedName}`,
          description: `${topBreed.breedName} is the most popular breed in ${category.name} with ${topBreed.totalPets} pets`,
          data: topBreed
        });
      }

      const affordableBreeds = popularBreeds.filter(breed => breed.avgPrice < 3000000);
      if (affordableBreeds.length > 0) {
        recommendations.push({
          type: 'affordable_option',
          title: 'Budget-Friendly Options',
          description: 'These breeds offer great value in this category',
          data: affordableBreeds.slice(0, 3)
        });
      }

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

  async searchPetsByBreed(req, res) {
    try {
      const {
        keyword,
        q,
        type,
        breed_id,
        status = 'available',
        sortBy = 'created_at',
        sortOrder = 'desc',
        page = 1,
        limit = 10
      } = req.query;

      const searchTerm = keyword || q;
      
      console.log('🔍 Pet Search API called with:', {
        searchTerm,
        type,
        breed_id,
        status,
        page,
        limit
      });

      // Xây dựng query filter (bỏ price, age, weight, gender)
      const filter = {};

      if (searchTerm) {
        filter.$or = [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ];
      }

      if (type) {
        filter.type = { $regex: type, $options: 'i' };
      }

      if (breed_id) {
        filter.breed_id = breed_id;
      }

      if (status) {
        filter.status = status;
      }

      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const skip = (Number(page) - 1) * Number(limit);

      const pets = await this.model.find(filter)
        .populate('breed_id', 'name description')
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
            keyword: searchTerm,
            type,
            breed_id,
            status
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

  async getGroupedBreedResults(req, res, petFilter, validBreeds) {
    const { page = 1, limit = 5 } = req.query;
    const groupedResults = [];

    for (let breed of validBreeds) {
      const breedPetFilter = {
        ...petFilter,
        breed_id: breed._id
      };

      const pets = await this.model.find(breedPetFilter)
        .sort({ created_at: -1 })
        .limit(6)
        .lean();

      const totalPetsInBreed = await this.model.countDocuments(breedPetFilter);

      if (this.imageModel) {
        for (let pet of pets) {
          const images = await this.imageModel.find({
            [this.getImageForeignKey()]: pet._id
          }).lean();
          pet.images = images;
        }
      }

      groupedResults.push({
        breed: breed,
        pets: pets,
        totalPets: totalPetsInBreed,
        hasMore: totalPetsInBreed > 6
      });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const paginatedResults = groupedResults.slice(skip, skip + Number(limit));

    const totalBreeds = groupedResults.length;
    const totalPages = Math.ceil(totalBreeds / Number(limit));

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Grouped breed search completed successfully',
      data: {
        groupedResults: paginatedResults,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalBreeds,
          hasNextPage: Number(page) < totalPages,
          hasPrevPage: Number(page) > 1,
          limit: Number(limit)
        }
      }
    });
  }

  async getSimilarBreeds(req, res) {
    try {
      const { breedId } = req.params;
      const { limit = 5, includePets = false } = req.query;

      const targetBreed = await mongoose.model('Breed').findById(breedId)
        .populate('category_id', 'name')
        .lean();

      if (!targetBreed) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Breed not found',
          data: null
        });
      }

      const similarBreeds = await mongoose.model('Breed').find({
        category_id: targetBreed.category_id._id,
        _id: { $ne: breedId }
      })
        .populate('category_id', 'name description')
        .limit(Number(limit))
        .lean();

      const enrichedBreeds = [];

      for (let breed of similarBreeds) {
        const petCount = await this.model.countDocuments({
          breed_id: breed._id,
          status: 'available'
        });

        const breedData = {
          ...breed,
          availablePets: petCount
        };

        if (includePets === 'true') {
          const samplePets = await this.model.find({
            breed_id: breed._id,
            status: 'available'
          })
            .limit(3)
            .select('name price images')
            .lean();

          if (this.imageModel) {
            for (let pet of samplePets) {
              const images = await this.imageModel.find({
                [this.getImageForeignKey()]: pet._id
              }).lean();
              pet.images = images;
            }
          }

          breedData.samplePets = samplePets;
        }

        enrichedBreeds.push(breedData);
      }

      enrichedBreeds.sort((a, b) => b.availablePets - a.availablePets);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Similar breeds retrieved successfully',
        data: {
          targetBreed,
          similarBreeds: enrichedBreeds,
          category: targetBreed.category_id
        }
      });

    } catch (error) {
      console.error('Get similar breeds error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getBreedPopularityRanking(req, res) {
    try {
      const {
        categoryId,
        timeframe = 30,
        limit = 10,
        includeStats = true
      } = req.query;

      let matchFilter = {};

      if (timeframe > 0) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - Number(timeframe));
        matchFilter.created_at = { $gte: daysAgo };
      }

      let breedFilter = {};
      if (categoryId) {
        breedFilter.category_id = new mongoose.Types.ObjectId(categoryId);
      }

      const popularityPipeline = [
        { $match: matchFilter },
        {
          $group: {
            _id: '$breed_id',
            petCount: { $sum: 1 },
            avgPrice: { $avg: '$price' },
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            availableCount: {
              $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
            },
            soldCount: {
              $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] }
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
        { $unwind: '$breed' }
      ];

      if (categoryId) {
        popularityPipeline.push({
          $match: { 'breed.category_id': new mongoose.Types.ObjectId(categoryId) }
        });
      }

      popularityPipeline.push(
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
          $addFields: {
            popularityScore: {
              $add: [
                { $multiply: ['$petCount', 0.4] },
                { $multiply: ['$soldCount', 0.4] },
                { $multiply: ['$availableCount', 0.2] }
              ]
            }
          }
        },
        { $sort: { popularityScore: -1 } },
        { $limit: Number(limit) },
        {
          $project: {
            breed: '$breed',
            category: '$category',
            statistics: {
              totalPets: '$petCount',
              availablePets: '$availableCount',
              soldPets: '$soldCount',
              avgPrice: '$avgPrice',
              minPrice: '$minPrice',
              maxPrice: '$maxPrice',
              popularityScore: '$popularityScore'
            }
          }
        }
      );

      const popularBreeds = await this.model.aggregate(popularityPipeline);

      popularBreeds.forEach((item, index) => {
        item.rank = index + 1;
      });

      let additionalStats = {};
      if (includeStats === 'true') {
        const overallStats = await this.model.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: null,
              totalPets: { $sum: 1 },
              totalBreeds: { $addToSet: '$breed_id' },
              avgPrice: { $avg: '$price' }
            }
          },
          {
            $addFields: {
              uniqueBreeds: { $size: '$totalBreeds' }
            }
          }
        ]);

        additionalStats = overallStats[0] || {};
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Top ${limit} popular breeds in last ${timeframe} days`,
        data: {
          rankings: popularBreeds,
          timeframe: {
            days: Number(timeframe),
            from: timeframe > 0 ? new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000) : null,
            to: new Date()
          },
          statistics: additionalStats
        }
      });

    } catch (error) {
      console.error('Get breed popularity ranking error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async compareBreedPrices(req, res) {
    try {
      const { breedIds } = req.body;

      if (!breedIds || !Array.isArray(breedIds) || breedIds.length < 2) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Please provide at least 2 breed IDs to compare',
          data: null
        });
      }

      if (breedIds.length > 6) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Maximum 6 breeds can be compared at once',
          data: null
        });
      }

      const comparison = [];

      for (let breedId of breedIds) {
        const breed = await mongoose.model('Breed').findById(breedId)
          .populate('category_id', 'name')
          .lean();

        if (!breed) {
          return res.status(404).json({
            success: false,
            statusCode: 404,
            message: `Breed with ID ${breedId} not found`,
            data: null
          });
        }

        const priceStats = await this.model.aggregate([
          { $match: { breed_id: new mongoose.Types.ObjectId(breedId) } },
          {
            $group: {
              _id: null,
              totalPets: { $sum: 1 },
              avgPrice: { $avg: '$price' },
              minPrice: { $min: '$price' },
              maxPrice: { $max: '$price' },
              medianPrice: { $push: '$price' },
              availableCount: {
                $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
              }
            }
          }
        ]);

        const prices = priceStats[0]?.medianPrice || [];
        prices.sort((a, b) => a - b);
        const median = prices.length > 0 ?
          (prices.length % 2 === 0 ?
            (prices[Math.floor(prices.length / 2) - 1] + prices[Math.floor(prices.length / 2)]) / 2 :
            prices[Math.floor(prices.length / 2)]) : 0;

        const priceDistribution = await this.model.aggregate([
          { $match: { breed_id: new mongoose.Types.ObjectId(breedId) } },
          {
            $bucket: {
              groupBy: '$price',
              boundaries: [0, 1000000, 2000000, 3000000, 5000000, 10000000, Infinity],
              default: 'Other',
              output: {
                count: { $sum: 1 },
                percentage: { $sum: 1 }
              }
            }
          }
        ]);

        const totalForDistribution = priceStats[0]?.totalPets || 1;
        priceDistribution.forEach(bucket => {
          bucket.percentage = ((bucket.count / totalForDistribution) * 100).toFixed(1);
        });

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const priceTrends = await this.model.aggregate([
          {
            $match: {
              breed_id: new mongoose.Types.ObjectId(breedId),
              created_at: { $gte: sixMonthsAgo }
            }
          },
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
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        comparison.push({
          breed: breed,
          priceAnalysis: {
            overview: {
              totalPets: priceStats[0]?.totalPets || 0,
              availablePets: priceStats[0]?.availableCount || 0,
              avgPrice: priceStats[0]?.avgPrice || 0,
              minPrice: priceStats[0]?.minPrice || 0,
              maxPrice: priceStats[0]?.maxPrice || 0,
              medianPrice: median
            },
            distribution: priceDistribution,
            trends: priceTrends
          }
        });
      }

      const sortedByAvgPrice = [...comparison].sort((a, b) =>
        a.priceAnalysis.overview.avgPrice - b.priceAnalysis.overview.avgPrice
      );

      const insights = {
        bestValue: sortedByAvgPrice[0],
        mostExpensive: sortedByAvgPrice[sortedByAvgPrice.length - 1],
        priceRange: {
          lowest: Math.min(...comparison.map(c => c.priceAnalysis.overview.minPrice)),
          highest: Math.max(...comparison.map(c => c.priceAnalysis.overview.maxPrice))
        }
      };

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Breed price comparison completed successfully',
        data: {
          comparison,
          insights,
          comparedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Compare breed prices error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getBreedSearchSuggestions(req, res) {
    try {
      const { keyword, categoryId, limit = 10 } = req.query;

      if (!keyword || keyword.length < 2) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Keyword must be at least 2 characters',
          data: null
        });
      }

      let breedFilter = {
        $or: [
          { name: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } }
        ]
      };

      if (categoryId) {
        breedFilter.category_id = new mongoose.Types.ObjectId(categoryId);
      }

      const suggestions = await mongoose.model('Breed').aggregate([
        { $match: breedFilter },
        {
          $lookup: {
            from: 'pets',
            localField: '_id',
            foreignField: 'breed_id',
            as: 'pets'
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'category_id',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: '$category' },
        {
          $addFields: {
            totalPets: { $size: '$pets' },
            availablePets: {
              $size: {
                $filter: {
                  input: '$pets',
                  cond: { $eq: ['$$this.status', 'available'] }
                }
              }
            }
          }
        },
        {
          $project: {
            name: 1,
            description: 1,
            category: { name: 1, _id: 1 },
            totalPets: 1,
            availablePets: 1
          }
        },
        { $sort: { totalPets: -1, name: 1 } },
        { $limit: Number(limit) }
      ]);

      const petNameSuggestions = await this.model.distinct('name', {
        name: { $regex: keyword, $options: 'i' }
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Breed search suggestions retrieved successfully',
        data: {
          breeds: suggestions,
          petNames: petNameSuggestions.slice(0, 5),
          keyword,
          totalSuggestions: suggestions.length + Math.min(petNameSuggestions.length, 5)
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

  // // New method to get a single pet by ID
  // async getPetById(req, res) {
  //   try {
  //     const { id } = req.params;

  //     // Validate the ID
  //     if (!mongoose.Types.ObjectId.isValid(id)) {
  //       return res.status(400).json({
  //         success: false,
  //         statusCode: 400,
  //         message: 'Invalid pet ID format',
  //         data: null
  //       });
  //     }

  //     const pet = await this.model.findById(id)
  //       .populate('breed_id', 'name description category_id')
  //       .populate({
  //         path: 'breed_id',
  //         populate: {
  //           path: 'category_id',
  //           select: 'name description'
  //         }
  //       })
  //       .lean();

  //     if (!pet) {
  //       return res.status(404).json({
  //         success: false,
  //         statusCode: 404,
  //         message: 'Pet not found',
  //         data: null
  //       });
  //     }

  //     // Populate images
  //     if (this.imageModel) {
  //       const images = await this.imageModel.find({ [this.getImageForeignKey()]: pet._id }).lean();
  //       pet.images = images;
  //     }

  //     res.status(200).json({
  //       success: true,
  //       statusCode: 200,
  //       message: 'Pet retrieved successfully',
  //       data: pet
  //     });
  //   } catch (error) {
  //     console.error('Get pet by ID error:', error);
  //     res.status(500).json({
  //       success: false,
  //       statusCode: 500,
  //       message: 'Internal server error',
  //       data: null
  //     });
  //   }
  // }

  // Cập nhật method getPetById để include variants
async getPetById(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Invalid pet ID',
          data: null
        });
      }

      const pet = await this.model.findById(id)
        .populate('breed_id', 'name description category_id')
        .lean();

      if (!pet) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Pet not found',
          data: null
        });
      }

      // Populate images
      if (this.imageModel) {
        const images = await this.imageModel.find({ [this.getImageForeignKey()]: pet._id }).lean();
        pet.images = images;
      }

      // 🆕 Populate variants
      const variants = await PetVariant.find({ 
        pet_id: pet._id, 
        is_available: true 
      }).lean();

      // Tính final price cho mỗi variant
      const variantsWithPrice = await Promise.all(
        variants.map(async (variant) => {
          const finalPrice = pet.price + variant.price_adjustment;
          return {
            ...variant,
            final_price: finalPrice,
            display_name: `${variant.color} - ${variant.weight}kg - ${variant.gender} - ${variant.age} years`
          };
        })
      );

      pet.variants = variantsWithPrice;

      // 🆕 Thêm variant options cho frontend filter
      if (variantsWithPrice.length > 0) {
        const colors = [...new Set(variantsWithPrice.map(v => v.color))].sort();
        const genders = [...new Set(variantsWithPrice.map(v => v.gender))].sort();
        const ages = [...new Set(variantsWithPrice.map(v => v.age))].sort((a, b) => a - b);
        const weights = [...new Set(variantsWithPrice.map(v => v.weight))].sort((a, b) => a - b);

        pet.variant_options = {
          colors,
          genders,
          age_range: { min: Math.min(...ages), max: Math.max(...ages) }, 
          weight_range: { min: Math.min(...weights), max: Math.max(...weights) }
        };
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Pet retrieved successfully',
        data: pet
      });
    } catch (error) {
      console.error('Get pet by ID error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // 🆕 Method để tạo variants mặc định khi tạo pet mới
  async createDefaultVariants(petId, petData) {
    try {
      // Nếu pet có thông tin variants trong request, tạo variants
      const defaultVariant = new PetVariant({
        pet_id: petId,
        color: petData.color || 'Mixed',
        weight: petData.weight || 5,
        gender: petData.gender || 'Male',
        age: petData.age || 1,
        price_adjustment: 0,
        stock_quantity: 1
      });

      await defaultVariant.save();
      console.log(`✅ Created default variant for pet ${petId}`);
    } catch (error) {
      console.error('Create default variant error:', error);
      // Không throw error để không ảnh hưởng đến việc tạo pet
    }
  }

  // Cập nhật method create để tự động tạo default variant

  // 🆕 Method để tạo variants mặc định khi tạo pet mới
  async createDefaultVariants(petId, petData) {
    try {
      // Nếu pet có thông tin variants trong request, tạo variants
      const defaultVariant = new PetVariant({
        pet_id: petId,
        color: petData.color || 'Mixed',
        weight: petData.weight || 5,
        gender: petData.gender || 'Male',
        age: petData.age || 1,
        price_adjustment: 0,
        stock_quantity: 1
      });

      await defaultVariant.save();
      console.log(`✅ Created default variant for pet ${petId}`);
    } catch (error) {
      console.error('Create default variant error:', error);
      // Không throw error để không ảnh hưởng đến việc tạo pet
    }
  }

  // Cập nhật method create để tự động tạo default variant
 async create(req, res) {
  try {
    const { name, type, breed_id, description } = req.body;
    
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

    // Tạo pet object với model mới đơn giản
    const petData = {
      name,
      type,
      breed_id,
      description,
      status: req.body.status || 'available'
    };

    // Tạo pet
    const newEntity = new this.model(petData);
    const savedEntity = await newEntity.save();

    // Handle images nếu có
    if (req.files && req.files.length > 0 && this.imageModel) {
      const imagePromises = req.files.map(file => {
        const imageData = {
          url: file.path,
          is_primary: false,
          [this.getImageForeignKey()]: savedEntity._id
        };
        return new this.imageModel(imageData).save();
      });

      const savedImages = await Promise.all(imagePromises);
      
      if (savedImages.length > 0) {
        savedImages[0].is_primary = true;
        await savedImages[0].save();
      }
    }

    // Populate và trả về kết quả
    const populatedEntity = await this.model.findById(savedEntity._id)
      .populate('breed_id', 'name description');

    res.status(201).json({
      success: true,
      statusCode: 201,
      message: `${this.getEntityName()} created successfully`,
      data: populatedEntity
    });

  } catch (error) {
    console.error(`Create ${this.getEntityName()} error:`, error);
    
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        statusCode: 409,
        message: `${this.getEntityName()} already exists`,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
}
  
async getRelatedItems(req, res) {
  try {
    const { id: petId } = req.params;
    const { limit = 8 } = req.query;

    console.log('🔍 Finding related items for pet:', petId);

    // Lấy thông tin thú cưng hiện tại
    const currentPet = await Pet.findById(petId)
      .populate('breed_id')
      .lean();

    if (!currentPet) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Không tìm thấy thú cưng',
        data: null
      });
    }

    const relatedItems = [];

    // Lấy thú cưng cùng breed
    const sameBreedPets = await Pet.find({
      breed_id: currentPet.breed_id?._id,
      _id: { $ne: petId },
      status: 'available'
    })
    .populate('breed_id')
    .limit(4)
    .lean();

    // Thêm ảnh và variants cho pets cùng breed
    for (let pet of sameBreedPets) {
      // Thêm ảnh
      const images = await this.imageModel.find({ pet_id: pet._id })
        .select('url is_primary')
        .lean();
      pet.images = images;

      // Thêm thông tin variants
      const variants = await PetVariant.find({ 
        pet_id: pet._id, 
        is_available: true 
      }).lean();

      // Tính final price cho mỗi variant
      const variantsWithPrice = await Promise.all(
        variants.map(async (variant) => {
          const finalPrice = pet.price + (variant.import_price || 0); // Sử dụng import_price thay vì price_adjustment
          return {
            ...variant,
            final_price: finalPrice,
            display_name: `${variant.color} - ${variant.weight}kg - ${variant.gender} - ${variant.age} years`
          };
        })
      );

      pet.variants = variantsWithPrice;

      // Thêm variant options cho frontend filter
      if (variantsWithPrice.length > 0) {
        const colors = [...new Set(variantsWithPrice.map(v => v.color))].sort();
        const genders = [...new Set(variantsWithPrice.map(v => v.gender))].sort();
        const ages = [...new Set(variantsWithPrice.map(v => v.age))].sort((a, b) => a - b);
        const weights = [...new Set(variantsWithPrice.map(v => v.weight))].sort((a, b) => a - b);

        pet.variant_options = {
          colors,
          genders,
          age_range: { min: Math.min(...ages), max: Math.max(...ages) },
          weight_range: { min: Math.min(...weights), max: Math.max(...weights) }
        };

        // Tính display price và price range
        const prices = variantsWithPrice.map(v => v.final_price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        pet.display_price = minPrice;
        pet.price_range = {
          min: minPrice,
          max: maxPrice,
          hasRange: minPrice !== maxPrice
        };
      } else {
        pet.variants = [];
        pet.variant_options = {};
        pet.display_price = pet.price;
        pet.price_range = {
          min: pet.price,
          max: pet.price,
          hasRange: false
        };
      }

      pet.itemType = 'pet';
      pet.relationshipType = 'same-breed';
    }

    relatedItems.push(...sameBreedPets);

    // Tìm sản phẩm phù hợp (nếu có Product model)
    try {
      const relatedProducts = await this._findProductsForPetTypeHelper(
        currentPet.type, 
        Math.min(4, limit - relatedItems.length)
      );
      relatedItems.push(...relatedProducts);
    } catch (error) {
      console.log('Product search not available:', error.message);
    }

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: {
        relatedItems: relatedItems.slice(0, limit),
        totalCount: relatedItems.length,
        currentPet: {
          id: currentPet._id,
          name: currentPet.name,
          type: currentPet.type,
          breed: currentPet.breed_id?.name
        }
      },
      message: `Tìm thấy ${relatedItems.length} items liên quan cho ${currentPet.name}`
    });

  } catch (error) {
    console.error('❌ Error in getRelatedItems for pet:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Lỗi server khi lấy items liên quan',
      data: null,
      error: error.message
    });
  }
}


  /**
   * 🔧 HELPER: Tìm sản phẩm phù hợp với loài thú cưng (Internal helper)
   */
async _findProductsForPetTypeHelper(petType, limit = 4) {
    try {
      // ✅ FIX: Kiểm tra petType đúng cách
      if (!petType || typeof petType !== 'string') {
        console.error('Invalid petType:', petType);
        return [];
      }

      // Mapping thông minh pet type với keywords sản phẩm
      const productKeywords = {
        'chó': ['dog', 'chó', 'cún', 'thức ăn chó', 'đồ chó', 'phụ kiện chó', 'xương', 'bánh thưởng chó'],
        'mèo': ['cat', 'mèo', 'meo', 'thức ăn mèo', 'đồ mèo', 'phụ kiện mèo', 'cát vệ sinh', 'cần câu mèo'],
        'chim': ['bird', 'chim', 'thức ăn chim', 'lồng chim', 'đồ chim', 'hạt chim', 'vitamin chim'],
        'cá': ['fish', 'cá', 'thức ăn cá', 'bể cá', 'đồ cá', 'máy sục khí', 'phụ kiện bể cá'],
        'hamster': ['hamster', 'chuột', 'thức ăn hamster', 'lồng hamster', 'đồ hamster'],
        'thỏ': ['rabbit', 'thỏ', 'thức ăn thỏ', 'cỏ khô', 'đồ thỏ', 'lồng thỏ']
      };

      const keywords = productKeywords[petType.toLowerCase()] || [petType];
      const regexPattern = keywords.join('|');
      
      const products = await Product.find({
        $or: [
          { name: { $regex: regexPattern, $options: 'i' } },
          { description: { $regex: regexPattern, $options: 'i' } }
        ],
        status: 'active'
      })
      .populate('category_id')
      .limit(limit)
      .lean();

      // Thêm images và metadata cho products
      for (let product of products) {
        product.images = await ProductImage.find({ product_id: product._id })
          .select('url is_primary')
          .lean();
        product.itemType = 'product';
        product.relationshipType = 'pet-compatible';
        product.compatibleWithPetType = petType;
      }

      console.log(`✅ Found ${products.length} products for pet type: ${petType}`);
      return products;

    } catch (error) {
      console.error('❌ Error in _findProductsForPetTypeHelper:', error);
      return [];
    }
  }

  /**
   * 🆕 PUBLIC API: Route handler để tìm products cho pet type
   * Route: GET /api/pets/products-for/:petType
   */
  async findProductsForPetType(req, res) {
    try {
      const { petType } = req.params;
      const { limit = 12 } = req.query;

      console.log('🔍 Finding products for pet type:', petType);

      // ✅ FIX: Gọi helper method với đúng tham số
      const products = await this._findProductsForPetTypeHelper(
        decodeURIComponent(petType), // Decode URL encoding (mèo -> mèo)
        parseInt(limit)
      );

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Tìm thấy ${products.length} sản phẩm cho ${petType}`,
        data: {
          products,
          petType: decodeURIComponent(petType),
          totalCount: products.length
        }
      });

    } catch (error) {
      console.error('❌ Error in findProductsForPetType API:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi server khi tìm sản phẩm',
        data: null,
        error: error.message
      });
    }
  }


  /**
   * 🎯 API TƯƠNG TỰ: Tìm thú cưng tương tự (nâng cấp từ getSimilarBreeds)
   */
 /**
 * 🎯 API TƯƠNG TỰ: Tìm thú cưng tương tự (nâng cấp từ getSimilarBreeds)
 */
async getSimilarPetsAdvanced(req, res) {
  try {
    const { petId } = req.params;
    const { limit = 6, includeCrossCategory = false } = req.query;

    const currentPet = await Pet.findById(petId)
      .populate('breed_id')
      .lean();

    if (!currentPet) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Không tìm thấy thú cưng',
        data: null
      });
    }

    const similarityScores = [];

    // Tìm tất cả pets khác
    const otherPets = await Pet.find({
      _id: { $ne: petId },
      status: 'available'
    })
      .populate('breed_id')
      .lean();

    // Tính điểm tương tự cho từng pet
    for (let pet of otherPets) {
      let score = 0;

      // Cùng breed = 100 điểm
      if (pet.breed_id?._id?.toString() === currentPet.breed_id?._id?.toString()) {
        score += 100;
      }
      // Cùng category = 80 điểm (nếu includeCrossCategory là false)
      else if (
        !includeCrossCategory &&
        pet.breed_id?.category_id?.toString() === currentPet.breed_id?.category_id?.toString()
      ) {
        score += 80;
      }

      // Cùng type = 60 điểm
      if (pet.type === currentPet.type) {
        score += 60;
      }

      // Khoảng giá tương tự = 40 điểm
      const priceDiff = Math.abs(pet.price - currentPet.price);
      const priceRatio = priceDiff / currentPet.price;
      if (priceRatio <= 0.3) score += 40; // Chênh lệch <= 30%
      else if (priceRatio <= 0.5) score += 20; // Chênh lệch <= 50%

      // Tuổi tương tự = 20 điểm
      if (pet.age && currentPet.age) {
        const ageDiff = Math.abs(pet.age - currentPet.age);
        if (ageDiff <= 3) score += 20;
        else if (ageDiff <= 6) score += 10;
      }

      // Cùng giới tính = 10 điểm
      if (pet.gender === currentPet.gender) {
        score += 10;
      }

      if (score > 0) {
        similarityScores.push({ pet, score });
      }
    }

    // Sắp xếp theo điểm tương tự
    similarityScores.sort((a, b) => b.score - a.score);

    const topSimilar = similarityScores.slice(0, limit);

    // Thêm ảnh và variants cho pets tương tự
    for (let item of topSimilar) {
      const pet = item.pet;

      // Thêm ảnh
      pet.images = await this.imageModel.find({ pet_id: pet._id })
        .select('url is_primary')
        .lean();

      // 🆕 Thêm thông tin variants
      const variants = await PetVariant.find({
        pet_id: pet._id,
        is_available: true
      }).lean();

      // Tính final price cho mỗi variant
      const variantsWithPrice = await Promise.all(
        variants.map(async (variant) => {
          const finalPrice = pet.price + (variant.price_adjustment || 0);
          return {
            ...variant,
            final_price: finalPrice,
            display_name: `${variant.color} - ${variant.weight}kg - ${variant.gender} - ${variant.age} years`
          };
        })
      );

      pet.variants = variantsWithPrice;

      // 🆕 Thêm variant options cho frontend filter
      if (variantsWithPrice.length > 0) {
        const colors = [...new Set(variantsWithPrice.map(v => v.color))].sort();
        const genders = [...new Set(variantsWithPrice.map(v => v.gender))].sort();
        const ages = [...new Set(variantsWithPrice.map(v => v.age))].sort((a, b) => a - b);
        const weights = [...new Set(variantsWithPrice.map(v => v.weight))].sort((a, b) => a - b);

        pet.variant_options = {
          colors,
          genders,
          age_range: { min: Math.min(...ages), max: Math.max(...ages) },
          weight_range: { min: Math.min(...weights), max: Math.max(...weights) }
        };

        // 🆕 Tính display price và price range
        const prices = variantsWithPrice.map(v => v.final_price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        pet.display_price = minPrice;
        pet.price_range = {
          min: minPrice,
          max: maxPrice,
          hasRange: minPrice !== maxPrice
        };
      } else {
        pet.variants = [];
        pet.variant_options = {};
        pet.display_price = pet.price;
        pet.price_range = {
          min: pet.price,
          max: pet.price,
          hasRange: false
        };
      }

      pet.itemType = 'pet';
      pet.similarityScore = item.score;
    }

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: {
        similarPets: topSimilar.map(item => ({
          ...item.pet,
          similarityScore: item.score
        })),
        totalAnalyzed: otherPets.length,
        currentPet: {
          id: currentPet._id,
          name: currentPet.name,
          type: currentPet.type,
          breed: currentPet.breed_id?.name,
          price: currentPet.price
        }
      },
      message: `Tìm thấy ${topSimilar.length} pets tương tự`
    });

  } catch (error) {
    console.error('❌ Error in getSimilarPetsAdvanced:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Lỗi server khi tìm pets tương tự',
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
  searchPets: petController.searchPets.bind(petController),
  searchSuggestions: petController.searchSuggestions.bind(petController),
  getFilterOptions: petController.getFilterOptions.bind(petController),
  getPetsByBreed: petController.getPetsByBreed.bind(petController),
  getPetsByCategory: petController.getPetsByCategory.bind(petController),
  getBreedStatistics: petController.getBreedStatistics.bind(petController),
  searchPetsByCategory: petController.searchPetsByCategory.bind(petController),
  getTrendingCategories: petController.getTrendingCategories.bind(petController),
  compareCategories: petController.compareCategories.bind(petController),
  getCategoryInsights: petController.getCategoryInsights.bind(petController),
  searchPetsByBreed: petController.searchPetsByBreed.bind(petController),
  getSimilarBreeds: petController.getSimilarBreeds.bind(petController),
  getBreedPopularityRanking: petController.getBreedPopularityRanking.bind(petController),
  compareBreedPrices: petController.compareBreedPrices.bind(petController),
  getBreedSearchSuggestions: petController.getBreedSearchSuggestions.bind(petController),
  getPetById: petController.getPetById.bind(petController),
  getRelatedItems: petController.getRelatedItems.bind(petController),
  getSimilarPetsAdvanced: petController.getSimilarPetsAdvanced.bind(petController),
  findProductsForPetType: petController.findProductsForPetType.bind(petController),
  
};