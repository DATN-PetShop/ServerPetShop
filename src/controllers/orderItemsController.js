const OrderItem = require('../models/OrderItem');
const Order = require('../models/Order');
const ProductImage = require('../models/ProductImage');
const Image = require('../models/ImagePet');

const createOrderItem = async (req, res) => {
  try {
    const { quantity, unit_price, pet_id, order_id, product_id, addresses_id } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!quantity || !unit_price || !order_id || !addresses_id) {
      return res.status(400).json({ message: 'Missing required fields: quantity, unit_price, order_id, or addresses_id' });
    }

    // Kiểm tra rằng chỉ một trong hai trường pet_id hoặc product_id được cung cấp
    if (!pet_id && !product_id) {
      return res.status(400).json({ message: 'At least one of pet_id or product_id must be provided' });
    }
    if (pet_id && product_id) {
      return res.status(400).json({ message: 'Only one of pet_id or product_id can be provided' });
    }

    const orderItem = new OrderItem({
      quantity,
      unit_price,
      pet_id: pet_id || null,
      order_id,
      product_id: product_id || null,
      addresses_id
    });

    const savedOrderItem = await orderItem.save();
    res.status(201).json({ message: 'Order item created', data: savedOrderItem });
  } catch (error) {
    console.error('Create order item error:', error.message);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

const getMyOrderItems = async (req, res) => {
  try {
    // Bước 1: Tìm tất cả Order của người dùng
    const orders = await Order.find({ user_id: req.user.userId }).select('_id').lean();
    const orderIds = orders.map(order => order._id);

    // Bước 2: Tìm OrderItems có order_id trong danh sách orderIds
    const orderItems = await OrderItem.find({ order_id: { $in: orderIds } })
      .populate('pet_id', 'name price')
      .populate('product_id', 'name price')
      .populate('addresses_id', 'address')
      .populate('order_id', 'total_amount status')
      .lean();
     // Populate images
      for (let item of orderItems) {
        if (item.pet_id) {
          const petImages = await Image.find({ pet_id: item.pet_id._id }).lean();
          item.pet_id.images = petImages;
        }
        if (item.product_id) {
          const productImages = await ProductImage.find({ product_id: item.product_id._id }).lean();
          item.product_id.images = productImages;
        }
      }
    res.status(200).json({ data: orderItems });
  } catch (error) {
    console.error('Fetch order items error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// orderItemsController.js
const getOrderItemsByOrderId = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Kiểm tra xem orderId có hợp lệ không
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Kiểm tra quyền truy cập
    if (order.user_id.toString() !== req.user.userId && !['Admin', 'Staff'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized to access these order items' });
    }

    // Lấy danh sách các mục đơn hàng
    const orderItems = await OrderItem.find({ order_id: orderId })
      .populate('pet_id', 'name price')
      .populate('product_id', 'name price')
      .populate('addresses_id', 'name phone note province district ward postal_code country')
      .populate('order_id', 'total_amount status')
      .lean();
    // Populate images
    for (let item of orderItems) {
      if (item.pet_id) {
        const petImages = await Image.find({ pet_id: item.pet_id._id }).lean();
        item.pet_id.images = petImages;
      }
      if (item.product_id) {
        const productImages = await ProductImage.find({ product_id: item.product_id._id }).lean();
        item.product_id.images = productImages;
      }
    }

    // Trả về mảng rỗng nếu không có mục đơn hàng
    res.status(200).json({ data: orderItems });
  } catch (error) {
    console.error('Fetch order items by order ID error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateOrderItem = async (req, res) => {
  try {
    const updatedOrderItem = await OrderItem.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.userId },
      req.body,
      { new: true }
    );

    if (!updatedOrderItem) return res.status(404).json({ message: 'Order item not found' });

    res.status(200).json({ message: 'Order item updated', data: updatedOrderItem });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteOrderItem = async (req, res) => {
  try {
    const deletedOrderItem = await OrderItem.findOneAndDelete({
      _id: req.params.id,
      user_id: req.user.userId
    });

    if (!deletedOrderItem) return res.status(404).json({ message: 'Order item not found' });

    res.status(200).json({ message: 'Order item deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};
// orderItemsController.js
const searchOrderItems = async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Tìm các order của user
    const orders = await Order.find({ user_id: req.user.userId }).select('_id').lean();
    const orderIds = orders.map(order => order._id);

    // Sử dụng aggregation để join và tìm kiếm
    const orderItems = await OrderItem.aggregate([
      // Lọc các OrderItem theo orderIds
      { $match: { order_id: { $in: orderIds } } },
      // Join với collection Pet
      {
        $lookup: {
          from: 'pets', // Tên collection của Pet (kiểm tra tên chính xác trong MongoDB)
          localField: 'pet_id',
          foreignField: '_id',
          as: 'pet_data'
        }
      },
      // Join với collection Product
      {
        $lookup: {
          from: 'products', // Tên collection của Product
          localField: 'product_id',
          foreignField: '_id',
          as: 'product_data'
        }
      },
      // Join với collection Order
      {
        $lookup: {
          from: 'orders',
          localField: 'order_id',
          foreignField: '_id',
          as: 'order_data'
        }
      },
      // Join với collection Address
      {
        $lookup: {
          from: 'addresses',
          localField: 'addresses_id',
          foreignField: '_id',
          as: 'address_data'
        }
      },
      // Unwind để xử lý mảng (vì $lookup trả về mảng)
      { $unwind: { path: '$pet_data', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$product_data', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$order_data', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$address_data', preserveNullAndEmptyArrays: true } },
      // Tìm kiếm theo tên pet, tên product hoặc _id
      {
        $match: {
          $or: [
            { 'pet_data.name': { $regex: query, $options: 'i' } },
            { 'product_data.name': { $regex: query, $options: 'i' } },
            { _id: { $regex: query, $options: 'i' } }
          ]
        }
      },
      // Phân trang
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) },
      // Project để định dạng output
      {
        $project: {
          _id: 1,
          quantity: 1,
          unit_price: 1,
          pet_id: { $cond: [{ $ifNull: ['$pet_data', false] }, { _id: '$pet_data._id', name: '$pet_data.name', price: '$pet_data.price' }, null] },
          product_id: { $cond: [{ $ifNull: ['$product_data', false] }, { _id: '$product_data._id', name: '$product_data.name', price: '$product_data.price' }, null] },
          order_id: { total_amount: '$order_data.total_amount', status: '$order_data.status' },
          addresses_id: {
            name: '$address_data.name',
            phone: '$address_data.phone',
            note: '$address_data.note',
            province: '$address_data.province',
            district: '$address_data.district',
            ward: '$address_data.ward',
            postal_code: '$address_data.postal_code',
            country: '$address_data.country'
          },
          created_at: 1,
          updated_at: 1
        }
      }
    ]);

    // Populate images
    for (let item of orderItems) {
      if (item.pet_id) {
        const petImages = await Image.find({ pet_id: item.pet_id._id }).lean();
        item.pet_id.images = petImages;
      }
      if (item.product_id) {
        const productImages = await ProductImage.find({ product_id: item.product_id._id }).lean();
        item.product_id.images = productImages;
      }
    }

    // Đếm tổng số kết quả
    const totalCount = await OrderItem.aggregate([
      { $match: { order_id: { $in: orderIds } } },
      {
        $lookup: {
          from: 'pets',
          localField: 'pet_id',
          foreignField: '_id',
          as: 'pet_data'
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: '_id',
          as: 'product_data'
        }
      },
      { $unwind: { path: '$pet_data', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$product_data', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { 'pet_data.name': { $regex: query, $options: 'i' } },
            { 'product_data.name': { $regex: query, $options: 'i' } },
            { _id: { $regex: query, $options: 'i' } }
          ]
        }
      },
      { $count: 'total' }
    ]);

    const total = totalCount.length > 0 ? totalCount[0].total : 0;

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Order items retrieved successfully',
      data: {
        items: orderItems,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCount: total,
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Search order items error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


module.exports = {
  createOrderItem,
  getMyOrderItems,
  getOrderItemsByOrderId,
  updateOrderItem,
  deleteOrderItem,
  searchOrderItems
};