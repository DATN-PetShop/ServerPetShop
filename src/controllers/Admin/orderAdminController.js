// ServerPetShop/src/controllers/orderAdminController.js - UPDATED WITH VARIANT SUPPORT
const Order = require('../../models/Order');
const OrderItem = require('../../models/OrderItem');
const User = require('../../models/User');
const Pet = require('../../models/Pet');
const Product = require('../../models/Product');
const PetVariant = require('../../models/PetVariant'); // 🆕 THÊM
const ProductImage = require('../../models/ProductImage');
const Image = require('../../models/ImagePet');

// ✅ API lấy tất cả đơn hàng cho Admin (GIỮ NGUYÊN)
const getAllOrders = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      payment_method, 
      user_id,
      start_date,
      end_date,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (payment_method) filter.payment_method = payment_method;
    if (user_id) filter.user_id = user_id;
    
    if (start_date || end_date) {
      filter.created_at = {};
      if (start_date) filter.created_at.$gte = new Date(start_date);
      if (end_date) filter.created_at.$lte = new Date(end_date);
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    const skip = (Number(page) - 1) * Number(limit);

    let query = Order.find(filter)
      .populate('user_id', 'username email phone full_name')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    if (search) {
      const users = await User.find({
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { full_name: { $regex: search, $options: 'i' } }
        ]
      }).select('_id').lean();
      
      const userIds = users.map(user => user._id);
      filter.$or = [
        { user_id: { $in: userIds } },
        { _id: { $regex: search, $options: 'i' } }
      ];
      
      query = Order.find(filter)
        .populate('user_id', 'username email phone full_name')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean();
    }

    const orders = await query;
    const totalCount = await Order.countDocuments(filter);
    
    const statistics = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total_amount' },
          totalOrders: { $sum: 1 },
          completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          pendingOrders: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          processingOrders: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
          cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
        }
      }
    ]);

    const totalPages = Math.ceil(totalCount / Number(limit));

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Orders retrieved successfully',
      data: {
        orders,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalCount,
          hasNextPage: Number(page) < totalPages,
          hasPrevPage: Number(page) > 1,
          limit: Number(limit)
        },
        statistics: statistics[0] || {
          totalRevenue: 0,
          totalOrders: 0,
          completedOrders: 0,
          pendingOrders: 0,
          processingOrders: 0,
          cancelledOrders: 0
        }
      }
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

// ✅ API cập nhật trạng thái đơn hàng cho Admin (GIỮ NGUYÊN)
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Invalid status value'
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Order not found'
      });
    }

    order.status = status;
    order.updated_at = new Date();
    if (notes) order.admin_notes = notes;

    await order.save();
    await order.populate('user_id', 'username email phone full_name');

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

// 🔧 CẬP NHẬT: API lấy chi tiết đơn hàng với order items cho Admin - THÊM VARIANT SUPPORT
const getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔍 Getting order details for order:', id);

    // 1. Lấy thông tin order
    const order = await Order.findById(id)
      .populate('user_id', 'username email phone full_name')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Order not found'
      });
    }

    console.log('✅ Found order:', order._id);

    // 2. Lấy order items với đầy đủ thông tin variant
    const orderItems = await OrderItem.find({ order_id: id })
      .populate({
        path: 'pet_id',
        select: 'name price type breed_id',
        populate: {
          path: 'breed_id',
          select: 'name'
        }
      })
      .populate({
        path: 'product_id',
        select: 'name price description category_id',
        populate: {
          path: 'category_id',
          select: 'name'
        }
      })
      .populate({
        path: 'variant_id', // 🆕 THÊM populate variant
        select: 'color weight gender age pet_id',
        populate: {
          path: 'pet_id',
          select: 'name price type breed_id',
          populate: {
            path: 'breed_id',
            select: 'name'
          }
        }
      })
      .populate('addresses_id', 'name phone note province district ward postal_code country')
      .lean();

    console.log(`📋 Found ${orderItems.length} order items`);

    // 3. Populate images và xử lý data với variant support
    const orderItemsWithDetails = await Promise.all(
      orderItems.map(async (item, index) => {
        console.log(`🔄 Processing item ${index + 1}:`, {
          id: item._id,
          hasVariant: !!item.variant_id,
          hasPet: !!item.pet_id,
          hasProduct: !!item.product_id
        });

        let images = [];
        let itemInfo = null;
        let itemType = 'unknown';

        if (item.variant_id) {
          // 🏷️ Variant item
          console.log(`🏷️ Processing variant item:`, item.variant_id);
          
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
          
          // Lấy images từ pet của variant
          if (item.variant_id.pet_id && item.variant_id.pet_id._id) {
            images = await Image.find({ pet_id: item.variant_id.pet_id._id }).lean();
            console.log(`🖼️ Found ${images.length} images for variant pet`);
          }
          
        } else if (item.pet_id) {
          // 🐕 Direct pet item
          console.log(`🐕 Processing pet item:`, item.pet_id);
          
          itemType = 'pet';
          itemInfo = item.pet_id;
          images = await Image.find({ pet_id: item.pet_id._id }).lean();
          console.log(`🖼️ Found ${images.length} images for pet`);
          
        } else if (item.product_id) {
          // 📦 Product item
          console.log(`📦 Processing product item:`, item.product_id);
          
          itemType = 'product';
          itemInfo = item.product_id;
          images = await ProductImage.find({ product_id: item.product_id._id }).lean();
          console.log(`🖼️ Found ${images.length} images for product`);
        }

        const processedItem = {
          ...item,
          item_type: itemType,
          item_info: itemInfo,
          images: images || []
        };

        console.log(`✅ Processed item ${index + 1}:`, {
          id: item._id,
          itemType,
          hasItemInfo: !!itemInfo,
          imageCount: images.length
        });

        return processedItem;
      })
    );

    console.log(`✅ Successfully processed all ${orderItemsWithDetails.length} order items`);

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Order details retrieved successfully',
      data: {
        order,
        orderItems: orderItemsWithDetails
      }
    });

  } catch (error) {
    console.error('❌ Get order details error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

// ✅ API thống kê đơn hàng (GIỮ NGUYÊN)
const getOrderStatistics = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const filter = {};
    if (start_date || end_date) {
      filter.created_at = {};
      if (start_date) filter.created_at.$gte = new Date(start_date);
      if (end_date) filter.created_at.$lte = new Date(end_date);
    }

    const overallStats = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total_amount' },
          avgOrderValue: { $avg: '$total_amount' },
          maxOrderValue: { $max: '$total_amount' },
          minOrderValue: { $min: '$total_amount' }
        }
      }
    ]);

    const statusStats = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$total_amount' }
        }
      }
    ]);

    const paymentStats = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$payment_method',
          count: { $sum: 1 },
          revenue: { $sum: '$total_amount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Order statistics retrieved successfully',
      data: {
        overall: overallStats[0] || {},
        byStatus: statusStats,
        byPaymentMethod: paymentStats
      }
    });
  } catch (error) {
    console.error('Get order statistics error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

// ✅ API lấy đơn hàng theo ID cho Admin (GIỮ NGUYÊN)
const getOrderByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await Order.findById(id)
      .populate('user_id', 'username email phone full_name')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Order retrieved successfully',
      data: order
    });
  } catch (error) {
    console.error('Get order by ID admin error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

// ✅ API cập nhật đơn hàng cho Admin (GIỮ NGUYÊN)
const updateOrderAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updated_at: new Date() };

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('user_id', 'username email phone full_name');

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Order updated successfully',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Update order admin error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

// ✅ API xóa đơn hàng cho Admin (GIỮ NGUYÊN)
const deleteOrderAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedOrder = await Order.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'Order not found'
      });
    }

    // Xóa các order items liên quan
    await OrderItem.deleteMany({ order_id: id });

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Order and related items deleted successfully'
    });
  } catch (error) {
    console.error('Delete order admin error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllOrders,
  updateOrderStatus,
  getOrderDetails,
  getOrderStatistics,
  getOrderByIdAdmin,
  updateOrderAdmin,
  deleteOrderAdmin
};