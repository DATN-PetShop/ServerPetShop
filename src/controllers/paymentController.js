const Payment = require('../models/Payment');

class PaymentController {
  constructor() {
    this.model = Payment;
  }

  getRequiredFields() {
    return ['amount', 'payment_method', 'transaction_id', 'order_id'];
  }

  getEntityName() {
    return 'Payment';
  }

  async createPayment(req, res) {
    try {
      const requiredFields = this.getRequiredFields();
      for (let field of requiredFields) {
        if (!req.body[field]) {
          return res.status(400).json({
            success: false,
            statusCode: 400,
            message: `${field} is required`,
            data: null
          });
        }
      }

      const payment = new this.model(req.body);
      const savedPayment = await payment.save();

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Payment created successfully',
        data: savedPayment
      });
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getAllPayments(req, res) {
    try {
      const payments = await this.model.find()
        .populate('order_id', 'order_number total_amount')
        .lean();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'All payments retrieved successfully',
        data: payments
      });
    } catch (error) {
      console.error('Get all payments error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async updatePayment(req, res) {
    try {
      const payment = await this.model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!payment) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Payment not found',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Payment updated successfully',
        data: payment
      });
    } catch (error) {
      console.error('Update payment error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async deletePayment(req, res) {
    try {
      const payment = await this.model.findByIdAndDelete(req.params.id);
      if (!payment) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Payment not found',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Payment deleted successfully',
        data: null
      });
    } catch (error) {
      console.error('Delete payment error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
}

module.exports = {
  createPayment: new PaymentController().createPayment.bind(new PaymentController()),
  getAllPayments: new PaymentController().getAllPayments.bind(new PaymentController()),
  updatePayment: new PaymentController().updatePayment.bind(new PaymentController()),
  deletePayment: new PaymentController().deletePayment.bind(new PaymentController())
};