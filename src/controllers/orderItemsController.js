const OrderItem = require('../models/OrderItem');

const createOrderItem = async (req, res) => {
  try {
    const { quantity, unit_price, pet_id, order_id, product_id, addresses_id } = req.body;

    if (!quantity || !unit_price || !pet_id || !order_id || !product_id || !addresses_id) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const orderItem = new OrderItem({ 
      quantity,
      unit_price,
      pet_id,
      order_id,
      product_id,
      addresses_id,
      user_id: req.user.userId
    });

    const savedOrderItem = await orderItem.save();
    res.status(201).json({ message: 'Order item created', data: savedOrderItem });
  } catch (error) {
    console.error('Create order item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getMyOrderItems = async (req, res) => {
  try {
    const orderItems = await OrderItem.find({ user_id: req.user.userId }).lean();
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