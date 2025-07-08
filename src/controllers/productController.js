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

  async getProductById(req, res) {
    try {
      const { id } = req.params;

      // Kiểm tra ID hợp lệ
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Invalid product ID',
          data: null
        });
      }

      // Tìm sản phẩm theo ID
      const product = await this.model
        .findById(id)
        .populate('category_id', 'name description')
        .populate('user_id', 'username email')
        .lean();

      if (!product) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Product not found',
          data: null
        });
      }

      // Populate images cho sản phẩm
      if (this.imageModel) {
        const images = await this.imageModel
          .find({ [this.getImageForeignKey()]: product._id })
          .lean();
        product.images = images;
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Product retrieved successfully',
        data: product
      });
    } catch (error) {
      console.error('Get product by ID error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async searchProducts(req, res) {
  try {
    const {
      keyword,        // Từ frontend mới
      q,              // Từ frontend cũ (backward compatibility)
      categoryId,     // Lọc theo danh mục
      status,         // Lọc theo trạng thái
      minPrice,       // Giá tối thiểu
      maxPrice,       // Giá tối đa
      sortBy = 'created_at', // Sắp xếp theo
      sortOrder = 'desc',    // Thứ tự sắp xếp
      page = 1,       // Trang hiện tại
      limit = 10      // Số lượng sản phẩm mỗi trang
    } = req.query;

    // ✅ Support cả 'keyword' và 'q' parameter
    const searchTerm = keyword || q;
    
    console.log('🔍 Product Search API called with:', {
      searchTerm,
      categoryId,
      status,
      minPrice,
      maxPrice,
      page,
      limit
    });

    // Xây dựng query filter
    const filter = {};

    // Tìm kiếm theo keyword (tên hoặc mô tả)
    if (searchTerm) {
      filter.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Lọc theo categoryId
    if (categoryId) {
      filter.category_id = categoryId;
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

    // Xây dựng sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);

    const products = await this.model.find(filter)
      .populate('category_id', 'name description')
      .populate('user_id', 'username email')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Đếm tổng số kết quả
    const totalCount = await this.model.countDocuments(filter);

    // Populate images cho mỗi product
    if (this.imageModel) {
      for (let product of products) {
        const images = await this.imageModel.find({ [this.getImageForeignKey()]: product._id }).lean();
        product.images = images;
      }
    }

    // Tính toán thông tin pagination
    const totalPages = Math.ceil(totalCount / Number(limit));
    const hasNextPage = Number(page) < totalPages;
    const hasPrevPage = Number(page) > 1;

    console.log('✅ Product Search Results:', {
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
          hasNextPage,
          hasPrevPage,
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
    console.error('Search products error:', error);
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
      // Lấy tất cả các options để hiển thị trong filter
      const categories = await mongoose.model('Category').find()
        .select('_id name')
        .sort({ name: 1 });
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

const productController = new ProductController();
module.exports = {
  createProduct: productController.create.bind(productController),
  getAllProducts: productController.getAll.bind(productController),
  updateProduct: productController.update.bind(productController),
  deleteProduct: productController.delete.bind(productController),
  searchProducts: productController.searchProducts.bind(productController),
  getFilterOptions: productController.getFilterOptions.bind(productController),
  getProductById: productController.getProductById.bind(productController) // Thêm export hàm mới
};