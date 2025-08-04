// WebPetShopAdmin/src/controllers/productController.js - FIX IMAGE DISPLAY
const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
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

  // ✅ FIX: Enhanced getAll to always include images
  // async getAllProducts(req, res) {
  //   try {
  //     const {
  //       page = 1,
  //       limit = 10,
  //       sortBy = 'created_at',
  //       sortOrder = 'desc',
  //       status,
  //       categoryId,
  //       keyword
  //     } = req.query;

  //     console.log('🔍 GetAllProducts called with params:', {
  //       page, limit, sortBy, sortOrder, status, categoryId, keyword
  //     });

  //     // Build filter
  //     const filter = {};
  //     if (status) filter.status = status;
  //     if (categoryId) filter.category_id = categoryId;
  //     if (keyword) {
  //       filter.$or = [
  //         { name: { $regex: keyword, $options: 'i' } },
  //         { description: { $regex: keyword, $options: 'i' } }
  //       ];
  //     }

  //     // Build sort
  //     const sort = {};
  //     sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  //     const skip = (Number(page) - 1) * Number(limit);

  //     // Get products with category populated
  //     const products = await this.model.find(filter)
  //       .populate('category_id', 'name description')
  //       .sort(sort)
  //       .skip(skip)
  //       .limit(Number(limit))
  //       .lean();

  //     console.log(`📦 Found ${products.length} products`);

  //     // ✅ FIX: Always populate images for each product
  //     if (this.imageModel && products.length > 0) {
  //       for (let product of products) {
  //         const images = await this.imageModel
  //           .find({ [this.getImageForeignKey()]: product._id })
  //           .lean();
  //         product.images = images;
  //         console.log(`🖼️ Product ${product.name} has ${images.length} images`);
  //       }
  //     }

  //     // Count total for pagination
  //     const totalCount = await this.model.countDocuments(filter);
  //     const totalPages = Math.ceil(totalCount / Number(limit));

  //     console.log('✅ GetAllProducts response ready:', {
  //       productsCount: products.length,
  //       totalCount,
  //       currentPage: page,
  //       totalPages
  //     });

  //     res.status(200).json({
  //       success: true,
  //       statusCode: 200,
  //       message: 'Products retrieved successfully',
  //       data: {
  //         products,
  //         pagination: {
  //           currentPage: Number(page),
  //           totalPages,
  //           totalCount,
  //           hasNextPage: Number(page) < totalPages,
  //           hasPrevPage: Number(page) > 1,
  //           limit: Number(limit)
  //         }
  //       }
  //     });
  //   } catch (error) {
  //     console.error('❌ GetAllProducts error:', error);
  //     res.status(500).json({
  //       success: false,
  //       statusCode: 500,
  //       message: 'Internal server error',
  //       data: null
  //     });
  //   }
  // }

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
}

const productController = new ProductController();
module.exports = {
  createProduct: productController.create.bind(productController),
  getAllProducts: productController.getAll.bind(productController),
  // getAllProductsUser: productController.getAll.bind(productController),
  updateProduct: productController.update.bind(productController),
  deleteProduct: productController.delete.bind(productController),
  searchProducts: productController.searchProducts.bind(productController),
  getFilterOptions: productController.getFilterOptions.bind(productController),
  getProductById: productController.getProductById.bind(productController)
};