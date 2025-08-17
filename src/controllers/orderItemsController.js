// src/controllers/orderItemsController.js - FIXED VERSION

const OrderItem = require('../models/OrderItem');
const Order = require('../models/Order');
const Pet = require('../models/Pet');
const Product = require('../models/Product');
const PetVariant = require('../models/PetVariant');
const ProductImage = require('../models/ProductImage');
const Image = require('../models/ImagePet');
// ✅ THÊM IMPORT REVIEW MODEL
const Review = require('../models/Review');
const mongoose = require('mongoose');

const searchOrderItems = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      query, 
      keyword,  // Hỗ trợ cả query và keyword
      page = 1, 
      limit = 10,
      status    // Filter theo trạng thái đơn hàng
    } = req.query;

    const searchKeyword = query || keyword || '';
    
    console.log('🔍 Search order items request:', {
      userId,
      searchKeyword,
      page,
      limit,
      status
    });

    if (!searchKeyword.trim()) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Search keyword is required'
      });
    }

    // Bước 1: Tìm orders của user với filter status (nếu có)
    const orderFilter = { user_id: userId };
    if (status && status !== 'all') {
      orderFilter.status = status;
    }

    const orders = await Order.find(orderFilter).select('_id').lean();
    const orderIds = orders.map(order => order._id);

    if (orderIds.length === 0) {
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'No order items found',
        data: [],
        pagination: {
          currentPage: Number(page),
          totalPages: 0,
          totalCount: 0,
          hasNextPage: false,
          hasPrevPage: false,
          limit: Number(limit)
        }
      });
    }

    // Bước 2: Tạo search conditions cho order items
    const searchConditions = [];

    // Tìm kiếm theo Order ID (6 ký tự cuối)
    if (searchKeyword.length >= 3) {
      // Tìm orders có _id chứa keyword (tìm trong 6 ký tự cuối)
      const matchingOrders = orders.filter(order => 
        order._id.toString().slice(-6).toLowerCase().includes(searchKeyword.toLowerCase())
      );
      
      if (matchingOrders.length > 0) {
        searchConditions.push({
          order_id: { $in: matchingOrders.map(o => o._id) }
        });
      }
    }

    // Tìm kiếm trong Pet (tên pet, breed)
    try {
      const petSearchConditions = [
        { name: { $regex: searchKeyword, $options: 'i' } }
      ];

      // Tìm breed có tên chứa keyword
      const Breed = require('../models/Breed');
      const matchingBreeds = await Breed.find({
        name: { $regex: searchKeyword, $options: 'i' }
      }).select('_id').lean();

      if (matchingBreeds.length > 0) {
        petSearchConditions.push({
          breed_id: { $in: matchingBreeds.map(b => b._id) }
        });
      }

      const matchingPets = await Pet.find({
        $or: petSearchConditions
      }).select('_id').lean();

      if (matchingPets.length > 0) {
        const petIds = matchingPets.map(p => p._id);
        
        // Tìm order items có pet_id trực tiếp
        searchConditions.push({ pet_id: { $in: petIds } });
        
        // Tìm variants của pets này
        const matchingVariants = await PetVariant.find({
          pet_id: { $in: petIds }
        }).select('_id').lean();

        if (matchingVariants.length > 0) {
          searchConditions.push({ 
            variant_id: { $in: matchingVariants.map(v => v._id) } 
          });
        }
      }
    } catch (petSearchError) {
      console.error('Pet search error:', petSearchError);
    }

    // Tìm kiếm trong Product
    try {
      const matchingProducts = await Product.find({
        $or: [
          { name: { $regex: searchKeyword, $options: 'i' } },
          { description: { $regex: searchKeyword, $options: 'i' } }
        ]
      }).select('_id').lean();

      if (matchingProducts.length > 0) {
        searchConditions.push({ 
          product_id: { $in: matchingProducts.map(p => p._id) } 
        });
      }
    } catch (productSearchError) {
      console.error('Product search error:', productSearchError);
    }

    // Nếu không có điều kiện tìm kiếm nào, trả về empty
    if (searchConditions.length === 0) {
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'No matching order items found',
        data: [],
        pagination: {
          currentPage: Number(page),
          totalPages: 0,
          totalCount: 0,
          hasNextPage: false,
          hasPrevPage: false,
          limit: Number(limit)
        }
      });
    }

    // Bước 3: Tìm order items với search conditions
    const orderItemFilter = {
      order_id: { $in: orderIds },
      $or: searchConditions
    };

    console.log('📋 Order item search filter:', JSON.stringify(orderItemFilter, null, 2));

    // Đếm tổng số items
    const totalCount = await OrderItem.countDocuments(orderItemFilter);

    // Phân trang
    const skip = (Number(page) - 1) * Number(limit);
    const totalPages = Math.ceil(totalCount / Number(limit));

    // Tìm order items với populate đầy đủ
    const orderItems = await OrderItem.find(orderItemFilter)
      .populate('pet_id', 'name price type breed_id')
      .populate('product_id', 'name price description')
      .populate({
        path: 'variant_id',
        populate: {
          path: 'pet_id',
          select: 'name price type breed_id',
          populate: {
            path: 'breed_id',
            select: 'name'
          }
        }
      })
      .populate('addresses_id', 'name phone ward district province')
      .populate('order_id', 'total_amount status payment_method created_at')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    console.log(`✅ Found ${orderItems.length} matching order items`);

    // Bước 4: Populate images cho mỗi item (giống logic getMyOrderItems)
    const orderItemsWithImages = await Promise.all(
      orderItems.map(async (item) => {
        let images = [];
        let itemInfo = null;
        let itemType = 'unknown';

        try {
          if (item.variant_id) {
            // Variant item - structured format
            itemType = 'variant';
            itemInfo = {
              _id: item.variant_id._id,
              name: item.variant_id.pet_id?.name,
              variant: {
                color: item.variant_id.color,
                weight: item.variant_id.weight,
                gender: item.variant_id.gender,
                age: item.variant_id.age
              }
            };
            
            if (item.variant_id.pet_id) {
              images = await Image.find({ pet_id: item.variant_id.pet_id._id }).lean();
            }
          } else if (item.pet_id) {
            // Direct pet item - structured format
            itemType = 'pet';
            itemInfo = {
              _id: item.pet_id._id,
              name: item.pet_id.name,
              breed_id: item.pet_id.breed_id,
              gender: item.pet_id.gender,
              age: item.pet_id.age
            };
            images = await Image.find({ pet_id: item.pet_id._id }).lean();
          } else if (item.product_id) {
            // Product item - structured format
            itemType = 'product';
            itemInfo = {
              _id: item.product_id._id,
              name: item.product_id.name,
              description: item.product_id.description
            };
            images = await ProductImage.find({ product_id: item.product_id._id }).lean();
          }
        } catch (imageError) {
          console.error('Error loading images for search:', imageError);
          images = [];
        }

        return {
          ...item,
          images,
          item_info: itemInfo,
          item_type: itemType
        };
      })
    );

    // Bước 5: Trả về kết quả
    res.status(200).json({
      success: true,
      statusCode: 200,
      message: `Found ${totalCount} matching order items`,
      data: orderItemsWithImages,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
        limit: Number(limit)
      },
      searchInfo: {
        keyword: searchKeyword,
        searchConditionsCount: searchConditions.length,
        statusFilter: status || 'all'
      }
    });

  } catch (error) {
    console.error('❌ Search order items error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const createOrderItem = async (req, res) => {
  try {
    const { quantity, unit_price, pet_id, product_id, variant_id, order_id, addresses_id } = req.body;

    console.log('🆕 Creating OrderItem with data:', req.body);

    // Kiểm tra các trường bắt buộc
    if (!quantity || !unit_price || !order_id || !addresses_id) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: quantity, unit_price, order_id, or addresses_id' 
      });
    }

    // 🔧 CẬP NHẬT VALIDATION cho variant_id
    const itemIds = [pet_id, product_id, variant_id].filter(Boolean);
    
    if (itemIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'At least one of pet_id, product_id, or variant_id must be provided' 
      });
    }
    
    if (itemIds.length > 1) {
      return res.status(400).json({ 
        success: false,
        message: 'Only one of pet_id, product_id, or variant_id can be provided' 
      });
    }

    // ✅ KIỂM TRA TỒN KHO VÀ CẬP NHẬT STOCK
    let itemToUpdate = null;
    let stockField = '';
    let currentStock = 0;

    if (variant_id) {
      // Kiểm tra PetVariant tồn tại và stock
      const variant = await PetVariant.findById(variant_id);
      if (!variant) {
        return res.status(404).json({ 
          success: false,
          message: 'Variant not found' 
        });
      }

      currentStock = variant.stock_quantity || 0;
      if (currentStock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`
        });
      }

      itemToUpdate = variant;
      stockField = 'stock_quantity';
      console.log('✅ Variant verified. Current stock:', currentStock);

    } else if (pet_id) {
      // Kiểm tra Pet tồn tại (Pet thường không có stock management)
      const pet = await Pet.findById(pet_id);
      if (!pet) {
        return res.status(404).json({ 
          success: false,
          message: 'Pet not found' 
        });
      }
      console.log('✅ Pet verified:', pet._id);

    } else if (product_id) {
      // Kiểm tra Product tồn tại và stock
      const product = await Product.findById(product_id);
      if (!product) {
        return res.status(404).json({ 
          success: false,
          message: 'Product not found' 
        });
      }

      currentStock = product.stock || 0;
      if (currentStock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`
        });
      }

      itemToUpdate = product;
      stockField = 'stock';
      console.log('✅ Product verified. Current stock:', currentStock);
    }

    // 🔧 Tạo OrderItem data
    const orderItemData = {
      quantity: parseInt(quantity),
      unit_price: parseFloat(unit_price),
      order_id,
      addresses_id
    };

    // Chỉ thêm ID nào có value
    if (variant_id) orderItemData.variant_id = variant_id;
    if (pet_id) orderItemData.pet_id = pet_id;
    if (product_id) orderItemData.product_id = product_id;

    console.log('Final orderItemData:', orderItemData);

    // 🆕 SỬ DỤNG TRANSACTION ĐỂ ĐẢM BẢO TÍNH NHẤT QUÁN
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Tạo OrderItem
        const orderItem = new OrderItem(orderItemData);
        const savedOrderItem = await orderItem.save({ session });
        
        // Cập nhật stock nếu cần thiết
        if (itemToUpdate && stockField) {
          const newStock = currentStock - parseInt(quantity);
          
          console.log(`📦 Updating stock: ${currentStock} - ${quantity} = ${newStock}`);
          
          if (variant_id) {
            await PetVariant.findByIdAndUpdate(
              variant_id,
              { $inc: { stock_quantity: -parseInt(quantity) } },
              { session, new: true }
            );
          } else if (product_id) {
            await Product.findByIdAndUpdate(
              product_id,
              { $inc: { stock: -parseInt(quantity) } },
              { session, new: true }
            );
          }
          
          console.log(`✅ Stock updated successfully. New stock: ${newStock}`);
        }

        console.log('✅ OrderItem created successfully:', savedOrderItem._id);
        
        // Trả về response (sẽ được commit nếu không có lỗi)
        res.status(201).json({ 
          success: true,
          message: 'Order item created and stock updated successfully', 
          data: savedOrderItem,
          stockInfo: itemToUpdate && stockField ? {
            previousStock: currentStock,
            quantityOrdered: parseInt(quantity),
            newStock: currentStock - parseInt(quantity)
          } : null
        });
      });
      
    } catch (transactionError) {
      console.error('❌ Transaction error:', transactionError);
      throw transactionError;
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('❌ Create order item error:', error.message);
    
    // Kiểm tra loại lỗi cụ thể
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Validation error',
        details: error.message
      });
    }
    
    if (error.name === 'MongoError' && error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'Duplicate entry error'
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// 🆕 CẬP NHẬT getMyOrderItems để populate variant
const getMyOrderItems = async (req, res) => {
  try {
    // ✅ KIỂM TRA USER ID
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Bước 1: Tìm tất cả Order của người dùng
    const orders = await Order.find({ user_id: userId }).select('_id').lean();
    const orderIds = orders.map(order => order._id);

    console.log('Found orders for user:', orderIds.length);

    // Bước 2: Tìm OrderItems với variant support
    const orderItems = await OrderItem.find({ order_id: { $in: orderIds } })
      .populate('pet_id', 'name price')
      .populate('product_id', 'name price')
      .populate({
        path: 'variant_id',
        populate: {
          path: 'pet_id',
          select: 'name price'
        }
      })
      .populate('addresses_id', 'name phone ward district province')
      .populate('order_id', 'total_amount status payment_method created_at')
      .sort({ created_at: -1 }) // ✅ Sắp xếp theo thời gian tạo mới nhất lên đầu
      .lean();

    // Bước 3: Populate images cho mỗi item
    const orderItemsWithImages = await Promise.all(
      orderItems.map(async (item) => {
        let images = [];
        
        try {
          if (item.variant_id) {
            // Variant item - lấy images từ pet của variant
            if (item.variant_id.pet_id) {
              images = await Image.find({ pet_id: item.variant_id.pet_id._id }).lean();
            }
          } else if (item.pet_id) {
            // Direct pet item
            images = await Image.find({ pet_id: item.pet_id._id }).lean();
          } else if (item.product_id) {
            // Product item
            images = await ProductImage.find({ product_id: item.product_id._id }).lean();
          }
        } catch (imageError) {
          console.error('Error loading images:', imageError);
          images = [];
        }

        return {
          ...item,
          images,
          item_type: item.variant_id ? 'variant' : (item.pet_id ? 'pet' : 'product')
        };
      })
    );

    res.status(200).json({ 
      success: true,
      data: orderItemsWithImages,
      message: `Found ${orderItemsWithImages.length} order items`
    });
    
  } catch (error) {
    console.error('❌ Fetch order items error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ✅ FIXED: HÀM KIỂM TRA TRẠNG THÁI ĐÁNH GIÁ CHO ORDER ITEM
const checkOrderItemReviewStatus = async (req, res) => {
  try {
    console.log('🔍 Starting checkOrderItemReviewStatus');
    console.log('Request params:', req.params);
    console.log('Request user:', req.user);

    const { id } = req.params; // orderItem ID
    
    // ✅ KIỂM TRA USER ID với nhiều format khác nhau
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    if (!userId) {
      console.log('❌ User not authenticated');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    console.log('OrderItem ID:', id);
    console.log('User ID:', userId);

    // ✅ VALIDATE ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('❌ Invalid ObjectId format');
      return res.status(400).json({
        success: false,
        message: 'Invalid order item ID format'
      });
    }

    // Kiểm tra orderItem có tồn tại không
    const orderItem = await OrderItem.findById(id)
      .populate('order_id', 'user_id status')
      .lean();

    console.log('Found orderItem:', orderItem ? 'Yes' : 'No');

    if (!orderItem) {
      console.log('❌ OrderItem not found');
      return res.status(404).json({
        success: false,
        message: 'Order item not found'
      });
    }

    // ✅ KIỂM TRA order_id có được populate không
    if (!orderItem.order_id) {
      console.log('❌ Order not populated for this item');
      return res.status(404).json({
        success: false,
        message: 'Order not found for this item'
      });
    }

    // Kiểm tra quyền sở hữu
    const orderUserId = orderItem.order_id.user_id.toString();
    console.log('Order User ID:', orderUserId);
    console.log('Current User ID:', userId.toString());

    if (orderUserId !== userId.toString()) {
      console.log('❌ Access denied - not owner');
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // ✅ KIỂM TRA XEM ĐÃ CÓ REVIEW CHO ITEM NÀY CHƯA
    let existingReview = null;
    
    console.log('Checking existing reviews...');
    console.log('OrderItem pet_id:', orderItem.pet_id);
    console.log('OrderItem product_id:', orderItem.product_id);
    console.log('OrderItem variant_id:', orderItem.variant_id);

    try {
      if (orderItem.pet_id) {
        existingReview = await Review.findOne({
          pet_id: orderItem.pet_id,
          user_id: userId
        }).lean();
        console.log('Found pet review:', existingReview ? 'Yes' : 'No');
      } else if (orderItem.product_id) {
        existingReview = await Review.findOne({
          product_id: orderItem.product_id,
          user_id: userId
        }).lean();
        console.log('Found product review:', existingReview ? 'Yes' : 'No');
      } else if (orderItem.variant_id) {
        // ✅ XỬ LÝ VARIANT: Tìm review cho pet của variant
        const variant = await PetVariant.findById(orderItem.variant_id).populate('pet_id');
        if (variant && variant.pet_id) {
          existingReview = await Review.findOne({
            pet_id: variant.pet_id._id,
            user_id: userId
          }).lean();
          console.log('Found variant pet review:', existingReview ? 'Yes' : 'No');
        }
      }
    } catch (reviewError) {
      console.error('Error checking reviews:', reviewError);
      // Continue without review check nếu có lỗi
      existingReview = null;
    }

    const result = {
      orderItemId: id,
      isReviewed: !!existingReview,
      canReview: orderItem.order_id.status === 'completed' && !existingReview,
      orderStatus: orderItem.order_id.status,
      reviewId: existingReview?._id || null
    };

    console.log('✅ Result:', result);

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Check review status error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: {
        name: error.name,
        message: error.message,
        // Only include stack in development
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      }
    });
  }
};

// ✅ HÀM LẤY DANH SÁCH ORDER ITEMS CÓ THÔNG TIN REVIEW STATUS
const getMyOrderItemsWithReviewStatus = async (req, res) => {
  try {
    console.log('🔍 Getting order items with review status');
    
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Bước 1: Tìm tất cả Order của người dùng
    const orders = await Order.find({ user_id: userId }).select('_id').lean();
    const orderIds = orders.map(order => order._id);

    console.log('Found orders:', orderIds.length);

    if (orderIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0
        }
      });
    }

    // Bước 2: Tìm OrderItems có order_id trong danh sách orderIds
    const orderItems = await OrderItem.find({ order_id: { $in: orderIds } })
      .populate('pet_id', 'name price')
      .populate('product_id', 'name price')
      .populate('addresses_id', 'name phone note province district ward postal_code country')
      .populate('order_id', 'total_amount status created_at updated_at')
      .populate('variant_id')
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    console.log('Found order items:', orderItems.length);

    // Bước 3: Populate images và kiểm tra review status
    for (let item of orderItems) {
      try {
        // Populate images
        if (item.pet_id) {
          const petImages = await Image.find({ pet_id: item.pet_id._id }).lean();
          item.pet_id.images = petImages;
        }
        if (item.product_id) {
          const productImages = await ProductImage.find({ product_id: item.product_id._id }).lean();
          item.product_id.images = productImages;
        }

        // Kiểm tra review status
        let existingReview = null;

        if (item.pet_id) {
          existingReview = await Review.findOne({
            pet_id: item.pet_id._id,
            user_id: userId
          }).lean();
        } else if (item.product_id) {
          existingReview = await Review.findOne({
            product_id: item.product_id._id,
            user_id: userId
          }).lean();
        } else if (item.variant_id) {
          // Xử lý variant
          const variant = await PetVariant.findById(item.variant_id).populate('pet_id');
          if (variant && variant.pet_id) {
            existingReview = await Review.findOne({
              pet_id: variant.pet_id._id,
              user_id: userId
            }).lean();
          }
        }

        // Thêm thông tin review status vào item
        item.reviewStatus = {
          isReviewed: !!existingReview,
          canReview: item.order_id.status === 'completed' && !existingReview,
          reviewId: existingReview?._id || null
        };
      } catch (itemError) {
        console.error('Error processing item:', item._id, itemError);
        // Set default review status nếu có lỗi
        item.reviewStatus = {
          isReviewed: false,
          canReview: item.order_id.status === 'completed',
          reviewId: null
        };
      }
    }

    res.status(200).json({
      success: true,
      data: orderItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: orderItems.length
      }
    });
  } catch (error) {
    console.error('❌ Fetch order items with review status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// CÁC HÀM KHÁC GIỮ NGUYÊN...
const getOrderItemsByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log('🔍 Fetching order items for order:', orderId);

    const orderItems = await OrderItem.find({ order_id: orderId })
      .populate('pet_id', 'name price type breed_id')
      .populate('product_id', 'name price description')
      .populate({
        path: 'variant_id',
        populate: {
          path: 'pet_id',
          select: 'name price type'
        }
      })
      .populate('addresses_id', 'name phone ward district province')
      .lean();

    if (!orderItems || orderItems.length === 0) {
      return res.status(404).json({ 
        message: 'No order items found for this order',
        data: [] 
      });
    }

    // Populate images
    const orderItemsWithImages = await Promise.all(
      orderItems.map(async (item) => {
        let images = [];
        let itemInfo = null;
        let itemType = 'unknown';

        if (item.variant_id) {
          itemType = 'variant';
          itemInfo = {
            ...item.variant_id.pet_id,
            variant: {
              _id: item.variant_id._id,
              color: item.variant_id.color,
              weight: item.variant_id.weight,
              gender: item.variant_id.gender,
              age: item.variant_id.age
            }
          };
          if (item.variant_id.pet_id) {
            images = await Image.find({ pet_id: item.variant_id.pet_id._id }).lean();
          }
        } else if (item.pet_id) {
          itemType = 'pet';
          itemInfo = item.pet_id;
          images = await Image.find({ pet_id: item.pet_id._id }).lean();
        } else if (item.product_id) {
          itemType = 'product';
          itemInfo = item.product_id;
          images = await ProductImage.find({ product_id: item.product_id._id }).lean();
        }

        return {
          ...item,
          item_type: itemType,
          item_info: itemInfo,
          images
        };
      })
    );

    console.log(`✅ Found ${orderItemsWithImages.length} order items`);
    
    res.status(200).json({ 
      data: orderItemsWithImages,
      message: `Found ${orderItemsWithImages.length} order items for order ${orderId}`
    });
    
  } catch (error) {
    console.error('❌ Fetch order items by order ID error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getOrderItemById = async (req, res) => {
  try {
    const orderItem = await OrderItem.findById(req.params.id)
      .populate('pet_id', 'name price')
      .populate('product_id', 'name price')
      .populate({
        path: 'variant_id',
        populate: {
          path: 'pet_id',
          select: 'name price'
        }
      })
      .populate('addresses_id')
      .populate('order_id');

    if (!orderItem) {
      return res.status(404).json({ message: 'Order item not found' });
    }

    res.status(200).json({ data: orderItem });
  } catch (error) {
    console.error('Fetch order item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateOrderItem = async (req, res) => {
  try {
    const updatedOrderItem = await OrderItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedOrderItem) {
      return res.status(404).json({ message: 'Order item not found' });
    }

    res.status(200).json({ 
      message: 'Order item updated', 
      data: updatedOrderItem 
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteOrderItem = async (req, res) => {
  try {
    const deletedOrderItem = await OrderItem.findByIdAndDelete(req.params.id);

    if (!deletedOrderItem) {
      return res.status(404).json({ message: 'Order item not found' });
    }

    res.status(200).json({ message: 'Order item deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  createOrderItem,
  getMyOrderItems,
  getOrderItemById,
  getOrderItemsByOrderId,
  updateOrderItem,
  deleteOrderItem,
  getMyOrderItemsWithReviewStatus,
  checkOrderItemReviewStatus, 
  searchOrderItems
};