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

const createOrderItem = async (req, res) => {
  try {
    const { quantity, unit_price, pet_id, product_id, variant_id, order_id, addresses_id } = req.body;

    console.log('🆕 Creating OrderItem with data:', req.body);

    // Kiểm tra các trường bắt buộc
    if (!quantity || !unit_price || !order_id || !addresses_id) {
      return res.status(400).json({ 
        message: 'Missing required fields: quantity, unit_price, order_id, or addresses_id' 
      });
    }

    // 🔧 CẬP NHẬT VALIDATION cho variant_id
    const itemIds = [pet_id, product_id, variant_id].filter(Boolean);
    
    if (itemIds.length === 0) {
      return res.status(400).json({ 
        message: 'At least one of pet_id, product_id, or variant_id must be provided' 
      });
    }
    
    if (itemIds.length > 1) {
      return res.status(400).json({ 
        message: 'Only one of pet_id, product_id, or variant_id can be provided' 
      });
    }

    // 🆕 VERIFY item tồn tại
    if (variant_id) {
      const variant = await PetVariant.findById(variant_id);
      if (!variant) {
        return res.status(404).json({ message: 'Variant not found' });
      }
      console.log('✅ Variant verified:', variant._id);
    } else if (pet_id) {
      const pet = await Pet.findById(pet_id);
      if (!pet) {
        return res.status(404).json({ message: 'Pet not found' });
      }
      console.log('✅ Pet verified:', pet._id);
    } else if (product_id) {
      const product = await Product.findById(product_id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      console.log('✅ Product verified:', product._id);
    }

    // 🔧 Tạo OrderItem với variant support
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

    const orderItem = new OrderItem(orderItemData);
    const savedOrderItem = await orderItem.save();
    
    console.log('✅ OrderItem created successfully:', savedOrderItem._id);
    
    res.status(201).json({ 
      message: 'Order item created', 
      data: savedOrderItem 
    });
    
  } catch (error) {
    console.error('❌ Create order item error:', error.message);
    res.status(500).json({ 
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
  getMyOrderItemsWithReviewStatus, // ✅ Export hàm mới
  checkOrderItemReviewStatus,       // ✅ Export hàm mới
};