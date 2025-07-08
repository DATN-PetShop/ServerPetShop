const Order = require('../models/Order');

const createOrder = async (req, res) => {
  try {
    const { total_amount, status, payment_method, vnpay_transaction_id, payment_date } = req.body;

    if (!total_amount || !status || !payment_method) {
      return res.status(400).json({ message: 'Missing required fields: total_amount, status, or payment_method' });
    }

    const order = new Order({
      total_amount,
      status,
      payment_method,
      vnpay_transaction_id: vnpay_transaction_id || null,
      payment_date: payment_date || null,
      user_id: req.user.userId
    });

    const savedOrder = await order.save();

    res.status(201).json({ message: 'Order created', data: savedOrder });
  } catch (error) {
    console.error('Create order error:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user_id: req.user.userId })
      .populate('user_id', 'name email') // Populate user_id with name and email fields
      .lean();

    res.status(200).json({ data: orders });
  } catch (error) {
    console.error('Fetch orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ 
      _id: req.params.id, 
      user_id: req.user.userId 
    })
      .populate('user_id', 'name email ') // Populate user_id with name and email fields
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({ data: order });
  } catch (error) {
    console.error('Fetch order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateOrder = async (req, res) => {
  try {
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.userId },
      req.body,
      { new: true }
    );

    if (!updatedOrder) return res.status(404).json({ message: 'Order not found' });

    res.status(200).json({ message: 'Order updated', data: updatedOrder });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const deletedOrder = await Order.findOneAndDelete({
      _id: req.params.id,
      user_id: req.user.userId
    });

    if (!deletedOrder) return res.status(404).json({ message: 'Order not found' });

    res.status(200).json({ message: 'Order deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

const saveVnpayOrder = async (req, res) => {
  try {
    const { vnp_Amount, vnp_TxnRef, vnp_PayDate, vnp_ResponseCode, vnp_TransactionStatus, user_id } = req.body;

    if (vnp_ResponseCode !== '00' || vnp_TransactionStatus !== '00') {
      return res.status(400).json({ message: 'Invalid payment status' });
    }

    const order = new Order({
      total_amount: vnp_Amount / 100, // Chia 100 để chuyển về VND
      status: 'completed',
      user_id,
      vnpay_transaction_id: vnp_TxnRef,
      payment_date: vnp_PayDate,
    });

    const savedOrder = await order.save();
    res.status(201).json({ message: 'Order created with VNPay data', data: savedOrder });
  } catch (error) {
    console.error('Save VNPay order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  saveVnpayOrder,
};