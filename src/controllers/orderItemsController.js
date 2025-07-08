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

module.exports = {
  createOrderItem,
  getMyOrderItems,
  updateOrderItem,
  deleteOrderItem
};