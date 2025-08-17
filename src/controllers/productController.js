// WebPetShopAdmin/src/controllers/productController.js - FIX IMAGE DISPLAY
const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
const Pet = require('../models/Pet');
const PetImage = require('../models/ImagePet');
const PetVariant = require('../models/PetVariant');
const BaseCrudController = require('./baseCrudController');
const mongoose = require('mongoose');

class ProductController extends BaseCrudController {
  constructor() {
    super(Product, ProductImage);
  }

  getRequiredFields() {
    return ['name', 'price'];
  }

  getEntityName() {
    return 'Product';
  }

  getImageForeignKey() {
    return 'product_id';
  }
// ✅ THÊM METHOD MỚI: getAllProductsAdmin - Dành riêng cho Admin/Staff
async getAllProductsAdmin(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      status, // Admin có thể xem tất cả status
      categoryId,
      keyword,
      showOutOfStock = 'true', // ✅ Admin mặc định xem cả sản phẩm hết hàng
      stockFilter = 'all', // all, in_stock, out_of_stock, low_stock
      priceMin,
      priceMax
    } = req.query;

    console.log('🔍 GetAllProductsAdmin called with params:', {
      page, limit, sortBy, sortOrder, status, categoryId, keyword, 
      showOutOfStock, stockFilter, priceMin, priceMax
    });

    // ✅ BUILD ADMIN FILTER - Admin có thể xem tất cả
    const filter = {};

    // Status filter - Admin có thể xem tất cả status
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Category filter
    if (categoryId && categoryId !== 'all') {
      filter.category_id = categoryId;
    }

    // ✅ STOCK FILTER - Nhiều options cho admin
    if (stockFilter !== 'all') {
      switch (stockFilter) {
        case 'in_stock':
          filter.stock = { $gt: 0 };
          break;
        case 'out_of_stock':
          filter.stock = { $eq: 0 };
          break;
        case 'low_stock':
          filter.stock = { $gt: 0, $lte: 5 }; // Từ 1-5 là low stock
          break;
      }
    }

    // ✅ PRICE RANGE FILTER
    if (priceMin || priceMax) {
      filter.price = {};
      if (priceMin) filter.price.$gte = Number(priceMin);
      if (priceMax) filter.price.$lte = Number(priceMax);
    }

    // Keyword search - Admin search toàn diện hơn
    if (keyword && keyword.trim()) {
      filter.$or = [
        { name: { $regex: keyword.trim(), $options: 'i' } },
        { description: { $regex: keyword.trim(), $options: 'i' } },
        { sku: { $regex: keyword.trim(), $options: 'i' } } // Admin có thể search theo SKU
      ];
    }

    console.log('📋 Admin Filter applied:', JSON.stringify(filter, null, 2));

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);

    // ✅ GET PRODUCTS với thông tin chi tiết cho admin
    const products = await this.model.find(filter)
      .populate('category_id', 'name description status')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    console.log(`📦 Admin found ${products.length} products matching filter`);

    // ✅ POPULATE IMAGES và thêm admin-specific info
    if (this.imageModel && products.length > 0) {
      for (let product of products) {
        const images = await this.imageModel
          .find({ [this.getImageForeignKey()]: product._id })
          .lean();
        product.images = images;
        
        // ✅ THÊM THÔNG TIN CHI TIẾT CHO ADMIN
        product.adminInfo = {
          stockStatus: {
            inStock: product.stock > 0,
            stockCount: product.stock,
            isLowStock: product.stock > 0 && product.stock <= 5,
            isCriticalStock: product.stock > 0 && product.stock <= 2,
            status: product.stock > 0 ? 'available' : 'out_of_stock'
          },
          salesInfo: {
            // Có thể thêm thông tin bán hàng sau này
            totalRevenue: product.price * (product.sold_count || 0),
            profitMargin: product.cost_price ? 
              ((product.price - product.cost_price) / product.price * 100).toFixed(2) + '%' : 'N/A'
          },
          timestamps: {
            created: product.created_at,
            updated: product.updated_at,
            lastSold: product.last_sold_at || null
          }
        };
        
        console.log(`🖼️ Admin - Product ${product.name}: ${images.length} images, stock: ${product.stock}`);
      }
    }

    // Count total cho pagination
    const totalCount = await this.model.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / Number(limit));

    // ✅ ADMIN STATISTICS - Thống kê chi tiết cho admin
    const adminStats = await this.model.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          activeProducts: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          inactiveProducts: {
            $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
          },
          draftProducts: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          inStockProducts: {
            $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] }
          },
          outOfStockProducts: {
            $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] }
          },
          lowStockProducts: {
            $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', 5] }] }, 1, 0] }
          },
          criticalStockProducts: {
            $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', 2] }] }, 1, 0] }
          },
          totalStockValue: { $sum: '$stock' },
          totalInventoryValue: { 
            $sum: { $multiply: ['$stock', '$cost_price'] }
          },
          totalPotentialRevenue: { 
            $sum: { $multiply: ['$stock', '$price'] }
          },
          averagePrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }
      }
    ]);

    // ✅ CATEGORY BREAKDOWN
    const categoryStats = await this.model.aggregate([
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $group: {
          _id: '$category_id',
          categoryName: { $first: { $arrayElemAt: ['$category.name', 0] } },
          productCount: { $sum: 1 },
          totalStock: { $sum: '$stock' },
          averagePrice: { $avg: '$price' },
          inStockCount: {
            $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] }
          }
        }
      },
      { $sort: { productCount: -1 } }
    ]);

    const stats = adminStats[0] || {
      totalProducts: 0,
      activeProducts: 0,
      inactiveProducts: 0,
      draftProducts: 0,
      inStockProducts: 0,
      outOfStockProducts: 0,
      lowStockProducts: 0,
      criticalStockProducts: 0,
      totalStockValue: 0,
      totalInventoryValue: 0,
      totalPotentialRevenue: 0,
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0
    };

    console.log('✅ GetAllProductsAdmin response ready:', {
      productsCount: products.length,
      totalCount,
      currentPage: page,
      totalPages,
      adminStats: stats
    });

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: `Admin: Found ${totalCount} products${filter.status ? ` (status: ${filter.status})` : ''}`,
      data: {
        products,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalCount,
          hasNextPage: Number(page) < totalPages,
          hasPrevPage: Number(page) > 1,
          limit: Number(limit)
        },
        // ✅ ADMIN DASHBOARD STATISTICS
        adminStatistics: {
          overview: stats,
          categoryBreakdown: categoryStats,
          alerts: {
            outOfStock: stats.outOfStockProducts,
            lowStock: stats.lowStockProducts,
            criticalStock: stats.criticalStockProducts,
            inactiveProducts: stats.inactiveProducts
          },
          filterApplied: {
            status: status || 'all',
            stockFilter: stockFilter || 'all',
            categoryFilter: categoryId || 'all',
            keyword: keyword || null,
            priceRange: priceMin || priceMax ? { min: priceMin, max: priceMax } : null
          }
        }
      }
    });
  } catch (error) {
    console.error('❌ GetAllProductsAdmin error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
  // ✅ FIX: Enhanced getAll to always include images
async getAllProducts(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      status,
      categoryId,
      keyword,
      showOutOfStock = false // ✅ THÊM OPTION để admin có thể xem sản phẩm hết hàng
    } = req.query;

    console.log('🔍 GetAllProducts called with params:', {
      page, limit, sortBy, sortOrder, status, categoryId, keyword, showOutOfStock
    });

    // ✅ BUILD FILTER - Mặc định chỉ hiển thị sản phẩm active và còn hàng
    const filter = {
      status: 'active' // ✅ Chỉ lấy sản phẩm active
    };

    // ✅ Kiểm tra tồn kho - Mặc định chỉ hiển thị sản phẩm còn hàng
    if (showOutOfStock !== 'true') {
      filter.stock = { $gt: 0 }; // Chỉ lấy sản phẩm có stock > 0
    }

    // Override status filter nếu được truyền vào (cho admin)
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Category filter
    if (categoryId && categoryId !== 'all') {
      filter.category_id = categoryId;
    }

    // Keyword search
    if (keyword && keyword.trim()) {
      filter.$or = [
        { name: { $regex: keyword.trim(), $options: 'i' } },
        { description: { $regex: keyword.trim(), $options: 'i' } }
      ];
    }

    console.log('📋 Filter applied:', JSON.stringify(filter, null, 2));

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);

    // Get products with category populated
    const products = await this.model.find(filter)
      .populate('category_id', 'name description')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    console.log(`📦 Found ${products.length} products matching filter`);

    // ✅ FIX: Always populate images for each product
    if (this.imageModel && products.length > 0) {
      for (let product of products) {
        const images = await this.imageModel
          .find({ [this.getImageForeignKey()]: product._id })
          .lean();
        product.images = images;
        
        // ✅ THÊM THÔNG TIN STOCK STATUS
        product.stockStatus = {
          inStock: product.stock > 0,
          stockCount: product.stock,
          isLowStock: product.stock > 0 && product.stock <= 5, // Cảnh báo khi stock <= 5
          status: product.stock > 0 ? 'available' : 'out_of_stock'
        };
        
        console.log(`🖼️ Product ${product.name}: ${images.length} images, stock: ${product.stock}`);
      }
    }

    // Count total for pagination với cùng filter
    const totalCount = await this.model.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / Number(limit));

    // ✅ THỐNG KÊ BỔ SUNG
    const stockStats = await this.model.aggregate([
      { $match: { status: 'active' } }, // Chỉ tính sản phẩm active
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          inStockProducts: {
            $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] }
          },
          outOfStockProducts: {
            $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] }
          },
          lowStockProducts: {
            $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', 5] }] }, 1, 0] }
          },
          totalStockValue: { $sum: '$stock' }
        }
      }
    ]);

    const stats = stockStats[0] || {
      totalProducts: 0,
      inStockProducts: 0,
      outOfStockProducts: 0,
      lowStockProducts: 0,
      totalStockValue: 0
    };

    console.log('✅ GetAllProducts response ready:', {
      productsCount: products.length,
      totalCount,
      currentPage: page,
      totalPages,
      stockStats: stats
    });

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: `Found ${totalCount} products${showOutOfStock !== 'true' ? ' (in stock only)' : ''}`,
      data: {
        products,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalCount,
          hasNextPage: Number(page) < totalPages,
          hasPrevPage: Number(page) > 1,
          limit: Number(limit)
        },
        // ✅ THÊM THỐNG KÊ KHO HÀNG
        stockStatistics: {
          ...stats,
          filterApplied: {
            showActiveOnly: filter.status === 'active',
            showInStockOnly: !!filter.stock,
            categoryFilter: categoryId || 'all',
            keyword: keyword || null
          }
        }
      }
    });
  } catch (error) {
    console.error('❌ GetAllProducts error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

  // ✅ FIX: Enhanced getProductById to include images
  async getProductById(req, res) {
    try {
      const { id } = req.params;

      console.log('🔍 GetProductById called for ID:', id);

      // Validate ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Invalid product ID',
          data: null
        });
      }

      // Find product with category populated
      const product = await this.model
        .findById(id)
        .populate('category_id', 'name description')
        .lean();

      if (!product) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Product not found',
          data: null
        });
      }

      // ✅ FIX: Always populate images
      if (this.imageModel) {
        const images = await this.imageModel
          .find({ [this.getImageForeignKey()]: product._id })
          .lean();
        product.images = images;
        console.log(`🖼️ Product ${product.name} has ${images.length} images:`, images);
      }

      console.log('✅ GetProductById response ready:', {
        productId: product._id,
        productName: product.name,
        imageCount: product.images?.length || 0
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Product retrieved successfully',
        data: product
      });
    } catch (error) {
      console.error('❌ GetProductById error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // ✅ FIX: Enhanced searchProducts to include images
  async searchProducts(req, res) {
    try {
      const {
        keyword,
        q,
        categoryId,
        status,
        minPrice,
        maxPrice,
        sortBy = 'created_at',
        sortOrder = 'desc',
        page = 1,
        limit = 10
      } = req.query;

      const searchTerm = keyword || q;
      
      console.log('🔍 SearchProducts called with:', {
        searchTerm, categoryId, status, minPrice, maxPrice, page, limit
      });

      // Build filter
      const filter = {};

      if (searchTerm) {
        filter.$or = [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ];
      }

      if (categoryId) filter.category_id = categoryId;
      if (status) filter.status = status;

      if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
      }

      // Build sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const skip = (Number(page) - 1) * Number(limit);

      // Get products with category populated
      const products = await this.model.find(filter)
        .populate('category_id', 'name description')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean();

      console.log(`📦 SearchProducts found ${products.length} products`);

      // ✅ FIX: Always populate images for each product
      if (this.imageModel && products.length > 0) {
        for (let product of products) {
          const images = await this.imageModel
            .find({ [this.getImageForeignKey()]: product._id })
            .lean();
          product.images = images;
          console.log(`🖼️ Product ${product.name} has ${images.length} images`);
        }
      }

      // Count total for pagination
      const totalCount = await this.model.countDocuments(filter);
      const totalPages = Math.ceil(totalCount / Number(limit));

      console.log('✅ SearchProducts response ready:', {
        productsFound: products.length,
        totalCount,
        currentPage: page,
        totalPages
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Search products completed successfully',
        data: {
          products,
          pagination: {
            currentPage: Number(page),
            totalPages,
            totalCount,
            hasNextPage: Number(page) < totalPages,
            hasPrevPage: Number(page) > 1,
            limit: Number(limit)
          },
          filters: {
            keyword: searchTerm,
            categoryId,
            status,
            priceRange: { min: minPrice, max: maxPrice }
          }
        }
      });
    } catch (error) {
      console.error('❌ SearchProducts error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getFilterOptions(req, res) {
    try {
      // Get all filter options for UI
      const categories = await mongoose.model('Category').find()
        .select('_id name')
        .sort({ name: 1 });
      const statuses = await this.model.distinct('status');

      // Get price range
      const priceRange = await this.model.aggregate([
        {
          $group: {
            _id: null,
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Filter options retrieved successfully',
        data: {
          categories,
          statuses,
          priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 }
        }
      });
    } catch (error) {
      console.error('❌ GetFilterOptions error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // ✅ FIX: Enhanced create to handle images properly
  async create(req, res) {
    try {
      console.log('🔧 CreateProduct called with:', {
        body: req.body,
        filesCount: req.files?.length || 0
      });

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

      // Create product
      const product = new this.model(data);
      const savedProduct = await product.save();

      console.log('✅ Product created:', savedProduct._id);

      // ✅ FIX: Handle image upload properly
      if (this.imageModel && req.files && req.files.length > 0) {
        console.log('🖼️ Processing', req.files.length, 'images');
        
        const imageDocs = req.files.map((file, index) => ({
          url: file.path, // Cloudinary URL from multer config
          is_primary: index === 0, // First image is primary
          [this.getImageForeignKey()]: savedProduct._id
        }));
        
        const savedImages = await this.imageModel.insertMany(imageDocs);
        console.log('✅ Images saved:', savedImages.length);
        
        // Add images to response
        savedProduct.images = savedImages;
      }

      // Populate category for response
      const populatedProduct = await this.model
        .findById(savedProduct._id)
        .populate('category_id', 'name description')
        .lean();

      // Add images to populated product
      if (this.imageModel) {
        const images = await this.imageModel
          .find({ [this.getImageForeignKey()]: populatedProduct._id })
          .lean();
        populatedProduct.images = images;
      }

      console.log('✅ CreateProduct success:', {
        productId: populatedProduct._id,
        imageCount: populatedProduct.images?.length || 0
      });

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Product created successfully',
        data: populatedProduct
      });
    } catch (error) {
      console.error('❌ CreateProduct error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ✅ FIX: Enhanced update to handle images properly
  async update(req, res) {
    try {
      console.log('🔧 UpdateProduct called for ID:', req.params.id);
      console.log('🔧 Update data:', req.body);
      console.log('🔧 New files count:', req.files?.length || 0);

      // Validate ID
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Invalid product ID',
          data: null
        });
      }

      // Update product data
      const updated = await this.model.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      ).populate('category_id', 'name description');

      if (!updated) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Product not found',
          data: null
        });
      }

      console.log('✅ Product updated:', updated._id);

      // ✅ FIX: Handle new images if provided
      if (this.imageModel && req.files && req.files.length > 0) {
        console.log('🖼️ Processing new images, count:', req.files.length);
        
        // Get old images for cleanup
        const oldImages = await this.imageModel.find({ 
          [this.getImageForeignKey()]: updated._id 
        });
        
        // Delete old images from Cloudinary
        if (oldImages.length > 0) {
          const { cloudinary } = require('../config/cloudinaryConfig');
          const deletePromises = oldImages.map(async (img) => {
            try {
              const publicId = this.extractPublicIdFromUrl(img.url);
              if (publicId) {
                await cloudinary.uploader.destroy(publicId);
                console.log('🗑️ Deleted image from Cloudinary:', publicId);
              }
            } catch (error) {
              console.error('❌ Error deleting image from Cloudinary:', error);
            }
          });
          await Promise.allSettled(deletePromises);
        }

        // Delete old image records
        await this.imageModel.deleteMany({ 
          [this.getImageForeignKey()]: updated._id 
        });
        console.log('🗑️ Deleted old image records');

        // Create new image records
        const imageDocs = req.files.map((file, index) => ({
          url: file.path, // Cloudinary URL
          is_primary: index === 0, // First image is primary
          [this.getImageForeignKey()]: updated._id
        }));
        
        const savedImages = await this.imageModel.insertMany(imageDocs);
        console.log('✅ New images saved:', savedImages.length);
      }

      // ✅ FIX: Always populate images for response
      if (this.imageModel) {
        const images = await this.imageModel
          .find({ [this.getImageForeignKey()]: updated._id })
          .lean();
        updated.images = images;
        console.log('🖼️ Populated images for response:', images.length);
      }

      console.log('✅ UpdateProduct success:', {
        productId: updated._id,
        imageCount: updated.images?.length || 0
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Product updated successfully',
        data: updated
      });
    } catch (error) {
      console.error('❌ UpdateProduct error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // ✅ FIX: Enhanced delete to handle images properly
  async delete(req, res) {
    try {
      console.log('🗑️ DeleteProduct called for ID:', req.params.id);

      // Validate ID
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Invalid product ID',
          data: null
        });
      }

      // Find and delete product
      const deleted = await this.model.findByIdAndDelete(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Product not found',
          data: null
        });
      }

      console.log('✅ Product deleted:', deleted._id);

      // ✅ FIX: Clean up related images
      if (this.imageModel) {
        const { cloudinary } = require('../config/cloudinaryConfig');
        const imagesToDelete = await this.imageModel.find({ 
          [this.getImageForeignKey()]: deleted._id 
        });
        
        console.log('🖼️ Found', imagesToDelete.length, 'images to delete');
        
        // Delete images from Cloudinary
        if (imagesToDelete.length > 0) {
          const deletePromises = imagesToDelete.map(async (img) => {
            try {
              const publicId = this.extractPublicIdFromUrl(img.url);
              if (publicId) {
                await cloudinary.uploader.destroy(publicId);
                console.log('🗑️ Deleted image from Cloudinary:', publicId);
              }
            } catch (error) {
              console.error('❌ Error deleting image from Cloudinary:', error);
            }
          });
          await Promise.allSettled(deletePromises);
        }

        // Delete image records from database
        await this.imageModel.deleteMany({ 
          [this.getImageForeignKey()]: deleted._id 
        });
        console.log('🗑️ Deleted image records from database');
      }

      console.log('✅ DeleteProduct success');

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Product deleted successfully',
        data: null
      });
    } catch (error) {
      console.error('❌ DeleteProduct error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  extractPublicIdFromUrl(url) {
    try {
      // Cloudinary URL format: https://res.cloudinary.com/cloud_name/image/upload/v123456/folder/public_id.jpg
      const parts = url.split('/');
      const uploadIndex = parts.indexOf('upload');
      if (uploadIndex !== -1 && uploadIndex + 2 < parts.length) {
        // Get part after 'upload/v123456/' and remove extension
        const publicIdWithExt = parts.slice(uploadIndex + 2).join('/');
        return publicIdWithExt.split('.')[0]; // Remove file extension
      }
      return null;
    } catch (error) {
      console.error('❌ Error extracting public_id:', error);
      return null;
    }
  }
  /**
   * 🔥 LOGIC THÔNG MINH: Lấy items liên quan cho sản phẩm
   * Route: GET /api/products/:id/related
   */
async findPetsForProductType(productCategory, productName, limit = 4) {
    try {
      console.log('🔍 Finding pets for product:', { productCategory, productName, limit });

      const relatedPets = [];
      
      // 🔥 DEBUG: First, let's see what pet types exist in database
      const allPetTypes = await Pet.distinct('type');
      console.log('🐾 All pet types in database:', allPetTypes);
      
      // ✅ FIX: Enhanced mapping với nhiều variations
      const productToPetMapping = {
        'Thức ăn cho chó': { 
          types: ['Chó', 'Dog', 'dog', 'CHÓ'], 
          keywords: ['chó', 'dog', 'canine'] 
        },
        'Thức ăn cho mèo': { 
          types: ['Mèo', 'Cat', 'cat', 'MÈO'], 
          keywords: ['mèo', 'cat', 'feline'] 
        },
        'Phụ kiện chó': { 
          types: ['Chó', 'Dog', 'dog', 'CHÓ'], 
          keywords: ['chó', 'dog', 'canine'] 
        },
        'Phụ kiện mèo': { 
          types: ['Mèo', 'Cat', 'cat', 'MÈO'], 
          keywords: ['mèo', 'cat', 'feline'] 
        },
        'Đồ chơi': { 
          types: null, 
          keywords: ['chó', 'mèo', 'dog', 'cat'] 
        },
        'Vệ sinh': { 
          types: null, 
          keywords: ['chó', 'mèo', 'dog', 'cat'] 
        }
      };

      let targetMapping = null;
      
      // Find matching category
      if (productCategory) {
        targetMapping = productToPetMapping[productCategory];
        console.log('📋 Found category mapping:', targetMapping);
      }
      
      // Fallback: check product name for keywords
      if (!targetMapping) {
        const lowerProductName = productName.toLowerCase();
        for (const [category, mapping] of Object.entries(productToPetMapping)) {
          if (mapping.keywords.some(keyword => lowerProductName.includes(keyword))) {
            targetMapping = mapping;
            console.log('🔍 Found keyword mapping:', category, targetMapping);
            break;
          }
        }
      }

      if (targetMapping) {
        const petFilter = { status: 'available' };
        
        // ✅ FIX: Better type filtering
        if (targetMapping.types && targetMapping.types.length > 0) {
          // Try exact matches first, then regex as fallback
          petFilter.$or = [
            { type: { $in: targetMapping.types } },
            { type: { $regex: targetMapping.types.join('|'), $options: 'i' } }
          ];
          console.log('🎯 Using specific type filter:', petFilter);
        } else {
          // General category - include common pets
          petFilter.$or = [
            { type: { $regex: 'chó|dog', $options: 'i' } },
            { type: { $regex: 'mèo|cat', $options: 'i' } }
          ];
          console.log('🎯 Using general type filter:', petFilter);
        }

        // 🔥 DEBUG: Log the exact query
        console.log('🔍 Pet query filter:', JSON.stringify(petFilter, null, 2));

        const pets = await Pet.find(petFilter)
          .populate('breed_id', 'name')
          .limit(limit)
          .lean();

        console.log(`🐾 Raw pet results count: ${pets.length}`);
        console.log(`🐾 Pet types found:`, pets.map(p => ({ name: p.name, type: p.type })));

        for (let pet of pets) {
          try {
            // ✅ FIX: Try multiple possible PetImage model references
            let petImages = [];
            try {
              petImages = await PetImage.find({ pet_id: pet._id })
                .select('url is_primary')
                .lean();
            } catch (imageError) {
              console.log(`⚠️ PetImage model might have different name, trying alternatives...`);
              // Try alternative model names if they exist
              try {
                const ImagePet = require('../models/ImagePet');
                petImages = await ImagePet.find({ pet_id: pet._id })
                  .select('url is_primary')
                  .lean();
              } catch (altError) {
                console.log(`⚠️ Could not find pet images for ${pet.name}:`, altError.message);
              }
            }
            
            pet.images = petImages;
            console.log(`🖼️ Pet ${pet.name} has ${petImages.length} images`);
            
            // Get pet variants
            const variants = await PetVariant.find({ 
              pet_id: pet._id, 
              is_available: true 
            }).limit(3).lean();
            
            pet.variants = variants.map(variant => ({
              ...variant,
              final_price: pet.price + variant.price_adjustment
            }));

            pet.itemType = 'pet';
            pet.relationshipType = 'suitable-for-product';
            
            relatedPets.push(pet);
          } catch (petError) {
            console.error(`❌ Error processing pet ${pet.name}:`, petError);
          }
        }

        console.log(`🐕 Final result: Found ${relatedPets.length} pets for category: ${productCategory || 'detected from name'}`);
      } else {
        console.log('❌ No mapping found for category/product name');
      }

      return relatedPets;
      
    } catch (error) {
      console.error('❌ Error in findPetsForProductType:', error);
      return [];
    }
  }

  /**
   * 🆕 NEW: Helper method to find products with similar prices
   */
  async findSimilarPriceProducts(currentProduct, limit = 4) {
    try {
      console.log('🔍 Finding similar price products for:', currentProduct.name, 'price:', currentProduct.price);

      // Calculate price range (±20%)
      const priceVariation = 0.2;
      const minPrice = currentProduct.price * (1 - priceVariation);
      const maxPrice = currentProduct.price * (1 + priceVariation);

      const similarProducts = await Product.find({
        _id: { $ne: currentProduct._id },
        price: { $gte: minPrice, $lte: maxPrice },
        status: 'active'
      })
      .populate('category_id', 'name description')
      .limit(limit)
      .lean();

      // Add images to each product
      for (let product of similarProducts) {
        const images = await this.imageModel.find({ product_id: product._id })
          .select('url is_primary')
          .lean();
        product.images = images;
        product.itemType = 'product';
        product.relationshipType = 'similar-price';
      }

      console.log(`💰 Found ${similarProducts.length} products with similar price range: ${minPrice.toFixed(0)} - ${maxPrice.toFixed(0)}`);
      
      return similarProducts;
      
    } catch (error) {
      console.error('❌ Error in findSimilarPriceProducts:', error);
      return [];
    }
  }

  /**
   * 🔥 LOGIC THÔNG MINH: Lấy items liên quan cho sản phẩm
   * Route: GET /api/products/:id/related
   */
  async getRelatedItems(req, res) {
    try {
      const { id: productId } = req.params;
      const { limit = 8 } = req.query;

      console.log('🔍 Finding related items for product:', productId);

      // 1️⃣ Lấy thông tin sản phẩm hiện tại
      const currentProduct = await Product.findById(productId)
        .populate('category_id')
        .lean();

      if (!currentProduct) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Không tìm thấy sản phẩm',
          data: null
        });
      }

      const relatedItems = [];

      // 2️⃣ Lấy sản phẩm cùng category (ưu tiên cao nhất)
      const sameCategoryProducts = await Product.find({
        category_id: currentProduct.category_id?._id,
        _id: { $ne: productId },
        status: 'active'
      })
      .populate('category_id')
      .limit(4)
      .lean();

      // Thêm ảnh và đánh dấu loại cho products cùng category
      for (let product of sameCategoryProducts) {
        product.images = await this.imageModel.find({ product_id: product._id })
          .select('url is_primary')
          .lean();
        product.itemType = 'product';
        product.relationshipType = 'same-category';
      }

      relatedItems.push(...sameCategoryProducts);

      // 3️⃣ Tìm thú cưng phù hợp với sản phẩm
      const relatedPets = await this.findPetsForProductType(
        currentProduct.category_id?.name,
        currentProduct.name,
        Math.min(4, limit - relatedItems.length)
      );
      
      relatedItems.push(...relatedPets);

      // 4️⃣ Nếu chưa đủ, thêm sản phẩm có giá tương tự
      if (relatedItems.length < limit) {
        const similarPriceProducts = await this.findSimilarPriceProducts(
          currentProduct,
          limit - relatedItems.length
        );
        relatedItems.push(...similarPriceProducts);
      }

      // 5️⃣ Trả về kết quả
      res.status(200).json({
        success: true,
        statusCode: 200,
        data: {
          relatedItems: relatedItems.slice(0, limit),
          totalCount: relatedItems.length,
          currentProduct: {
            id: currentProduct._id,
            name: currentProduct.name,
            category: currentProduct.category_id?.name,
            price: currentProduct.price
          },
          breakdown: {
            sameCategory: sameCategoryProducts.length,
            relatedPets: relatedPets.length,
            similarPrice: Math.max(0, relatedItems.length - sameCategoryProducts.length - relatedPets.length)
          }
        },
        message: `Tìm thấy ${relatedItems.length} items liên quan cho ${currentProduct.name}`
      });

    } catch (error) {
      console.error('❌ Error in getRelatedItems for product:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi server khi lấy items liên quan',
        data: null,
        error: error.message
      });
    }
  }
}

const productController = new ProductController();
module.exports = {
  createProduct: productController.create.bind(productController),
  getAllProductsAdmin: productController.getAllProductsAdmin.bind(productController),
  getAllProducts: productController.getAllProducts.bind(productController),
  updateProduct: productController.update.bind(productController),
  deleteProduct: productController.delete.bind(productController),
  searchProducts: productController.searchProducts.bind(productController),
  getFilterOptions: productController.getFilterOptions.bind(productController),
  getProductById: productController.getProductById.bind(productController),
  getRelatedItems: productController.getRelatedItems.bind(productController),

};