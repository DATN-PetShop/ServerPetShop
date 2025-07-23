// ServerPetShop/src/controllers/orderAdminController.js - Admin Order Management
const Order = require('../../models/Order');
const OrderItem = require('../../models/OrderItem');
const User = require('../../models/User');
const ProductImage = require('../../models/ProductImage');
const Image = require('../../models/ImagePet');

// ✅ API lấy tất cả đơn hàng cho Admin
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

// ✅ API cập nhật trạng thái đơn hàng cho Admin
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

// ✅ API lấy chi tiết đơn hàng với order items cho Admin
const getOrderDetails = async (req, res) => {
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

    const orderItems = await OrderItem.find({ order_id: id })
      .populate('pet_id', 'name price type breed_id')
      .populate('product_id', 'name price category_id')
      .populate('addresses_id', 'name phone note province district ward postal_code country')
      .lean();

    for (let item of orderItems) {
      if (item.pet_id) {
        const petImages = await Image.find({ pet_id: item.pet_id._id }).lean();
        item.pet_id.images = petImages;
        
        if (item.pet_id.breed_id) {
          await OrderItem.populate(item, {
            path: 'pet_id.breed_id',
            select: 'name'
          });
        }
      }
      if (item.product_id) {
        const productImages = await ProductImage.find({ product_id: item.product_id._id }).lean();
        item.product_id.images = productImages;
      }
    }

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Order details retrieved successfully',
      data: {
        order,
        orderItems
      }
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error'
    });
  }
};

// ✅ API thống kê đơn hàng
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

// ✅ API lấy đơn hàng theo ID cho Admin
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

// ✅ API cập nhật đơn hàng cho Admin
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

// ✅ API xóa đơn hàng cho Admin
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