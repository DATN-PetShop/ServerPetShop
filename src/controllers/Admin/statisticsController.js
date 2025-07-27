// src/controllers/statisticsController.js
const mongoose = require('mongoose');
const Order = require('../../models/Order');
const OrderItem = require('../../models/OrderItem');
const User = require('../../models/User');
const Pet = require('../../models/Pet');
const Product = require('../../models/Product');
const Category = require('../../models/Category');
const Appointment = require('../../models/Appointment');
const CareService = require('../../models/CareService');
const ChatRoom = require('../../models/ChatRoom');
const ChatMessage = require('../../models/ChatMessage');
const Voucher = require('../../models/Voucher');

class StatisticsController {
  // ===============================
  // 1. THỐNG KÊ DOANH THU VÀ BÁN HÀNG
  // ===============================
  
  async getRevenueStatistics(req, res) {
    try {
      const { startDate, endDate, period = 'month' } = req.query;
      
      let dateFilter = {};
      let groupBy = {};
      
      if (startDate && endDate) {
        dateFilter = {
          created_at: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      }
      
      // Xác định cách group theo period
      switch (period) {
        case 'day':
          groupBy = {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
            day: { $dayOfMonth: '$created_at' }
          };
          break;
        case 'week':
          groupBy = {
            year: { $year: '$created_at' },
            week: { $week: '$created_at' }
          };
          break;
        case 'month':
          groupBy = {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' }
          };
          break;
        case 'year':
          groupBy = {
            year: { $year: '$created_at' }
          };
          break;
      }
      
      const revenueByTime = await Order.aggregate([
        { $match: { ...dateFilter, status: 'completed' } },
        {
          $group: {
            _id: groupBy,
            totalRevenue: { $sum: '$total_amount' },
            totalOrders: { $sum: 1 },
            averageOrderValue: { $avg: '$total_amount' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Revenue statistics retrieved successfully',
        data: revenueByTime
      });
    } catch (error) {
      console.error('Revenue statistics error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
  
  async getTopSellingItems(req, res) {
    try {
      const { limit = 10, type = 'all' } = req.query;
      
      let matchCondition = {};
      if (type === 'pet') {
        matchCondition = { pet_id: { $ne: null } };
      } else if (type === 'product') {
        matchCondition = { product_id: { $ne: null } };
      }
      
      const topItems = await OrderItem.aggregate([
        {
          $lookup: {
            from: 'orders',
            localField: 'order_id',
            foreignField: '_id',
            as: 'order'
          }
        },
        { $unwind: '$order' },
        { $match: { 'order.status': 'completed', ...matchCondition } },
        {
          $group: {
            _id: {
              pet_id: '$pet_id',
              product_id: '$product_id'
            },
            totalQuantity: { $sum: '$quantity' },
            totalRevenue: { $sum: { $multiply: ['$quantity', '$unit_price'] } },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'pets',
            localField: '_id.pet_id',
            foreignField: '_id',
            as: 'pet'
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id.product_id',
            foreignField: '_id',
            as: 'product'
          }
        }
      ]);
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Top selling items retrieved successfully',
        data: topItems
      });
    } catch (error) {
      console.error('Top selling items error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
  
  async getOrderStatusStatistics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      let dateFilter = {};
      if (startDate && endDate) {
        dateFilter = {
          created_at: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      }
      
      const statusStats = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalValue: { $sum: '$total_amount' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Order status statistics retrieved successfully',
        data: statusStats
      });
    } catch (error) {
      console.error('Order status statistics error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
  
  // ===============================
  // 2. THỐNG KÊ KHÁCH HÀNG
  // ===============================
  
  async getCustomerStatistics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      let dateFilter = {};
      if (startDate && endDate) {
        dateFilter = {
          created_at: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      }
      
      // Tổng số khách hàng
      const totalCustomers = await User.countDocuments({ role: 'Customer' });
      
      // Khách hàng mới theo thời gian
      const newCustomers = await User.aggregate([
        { $match: { role: 'Customer', ...dateFilter } },
        {
          $group: {
            _id: {
              year: { $year: '$created_at' },
              month: { $month: '$created_at' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);
      
      // Khách hàng có giá trị cao nhất
      const highValueCustomers = await Order.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: '$user_id',
            totalSpent: { $sum: '$total_amount' },
            orderCount: { $sum: 1 },
            averageOrderValue: { $avg: '$total_amount' }
          }
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'customer'
          }
        },
        { $unwind: '$customer' },
        {
          $project: {
            customerInfo: {
              id: '$customer._id',
              username: '$customer.username',
              email: '$customer.email'
            },
            totalSpent: 1,
            orderCount: 1,
            averageOrderValue: 1
          }
        }
      ]);
      
      // Tỷ lệ khách hàng quay lại
      const returningCustomers = await Order.aggregate([
        {
          $group: {
            _id: '$user_id',
            orderCount: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: null,
            totalCustomers: { $sum: 1 },
            returningCustomers: {
              $sum: { $cond: [{ $gt: ['$orderCount', 1] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            totalCustomers: 1,
            returningCustomers: 1,
            returnRate: {
              $multiply: [
                { $divide: ['$returningCustomers', '$totalCustomers'] },
                100
              ]
            }
          }
        }
      ]);
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Customer statistics retrieved successfully',
        data: {
          totalCustomers,
          newCustomers,
          highValueCustomers,
          returnRate: returningCustomers[0] || { returnRate: 0 }
        }
      });
    } catch (error) {
      console.error('Customer statistics error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
  
  // ===============================
  // 3. THỐNG KÊ SẢN PHẨM VÀ THÚ CƯNG
  // ===============================
  
  async getInventoryStatistics(req, res) {
    try {
      // Tồn kho theo danh mục
      const inventoryByCategory = await Pet.aggregate([
        {
          $lookup: {
            from: 'breeds',
            localField: 'breed_id',
            foreignField: '_id',
            as: 'breed'
          }
        },
        { $unwind: '$breed' },
        {
          $lookup: {
            from: 'categories',
            localField: 'breed.category_id',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: '$category' },
        {
          $group: {
            _id: '$category._id',
            categoryName: { $first: '$category.name' },
            totalPets: { $sum: 1 },
            availablePets: {
              $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
            },
            soldPets: {
              $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] }
            },
            reservedPets: {
              $sum: { $cond: [{ $eq: ['$status', 'reserved'] }, 1, 0] }
            },
            averagePrice: { $avg: '$price' }
          }
        }
      ]);
      
      // Top 5 thú cưng bán chạy nhất
      const topPets = await OrderItem.aggregate([
        { $match: { pet_id: { $ne: null } } },
        {
          $lookup: {
            from: 'orders',
            localField: 'order_id',
            foreignField: '_id',
            as: 'order'
          }
        },
        { $unwind: '$order' },
        { $match: { 'order.status': 'completed' } },
        {
          $group: {
            _id: '$pet_id',
            totalSold: { $sum: '$quantity' },
            totalRevenue: { $sum: { $multiply: ['$quantity', '$unit_price'] } }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'pets',
            localField: '_id',
            foreignField: '_id',
            as: 'pet'
          }
        },
        { $unwind: '$pet' }
      ]);
      
      // Thống kê số lượng thú cưng theo loại
      const petsByType = await Pet.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            averagePrice: { $avg: '$price' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      // Sản phẩm sắp hết hàng (giả sử có trường stock)
      const lowStockProducts = await Product.aggregate([
        { $match: { stock: { $lt: 10 } } }, // Giả sử < 10 là sắp hết
        { $sort: { stock: 1 } },
        { $limit: 10 }
      ]);
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Inventory statistics retrieved successfully',
        data: {
          inventoryByCategory,
          topPets,
          petsByType,
          lowStockProducts
        }
      });
    } catch (error) {
      console.error('Inventory statistics error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
  
  // ===============================
  // 4. THỐNG KÊ DỊCH VỤ
  // ===============================
  
  async getServiceStatistics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      let dateFilter = {};
      if (startDate && endDate) {
        dateFilter = {
          created_at: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      }
      
      // Số lượng lịch hẹn theo thời gian
      const appointmentsByTime = await Appointment.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              year: { $year: '$created_at' },
              month: { $month: '$created_at' }
            },
            count: { $sum: 1 },
            totalRevenue: { $sum: '$total_amount' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);
      
      // Dịch vụ phổ biến nhất
      const popularServices = await Appointment.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$service_id',
            appointmentCount: { $sum: 1 },
            totalRevenue: { $sum: '$total_amount' }
          }
        },
        { $sort: { appointmentCount: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'careservices',
            localField: '_id',
            foreignField: '_id',
            as: 'service'
          }
        },
        { $unwind: '$service' }
      ]);
      
      // Tỷ lệ hoàn thành lịch hẹn
      const completionRate = await Appointment.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            total: 1,
            completed: 1,
            cancelled: 1,
            completionRate: {
              $multiply: [{ $divide: ['$completed', '$total'] }, 100]
            }
          }
        }
      ]);
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Service statistics retrieved successfully',
        data: {
          appointmentsByTime,
          popularServices,
          completionRate: completionRate[0] || { completionRate: 0 }
        }
      });
    } catch (error) {
      console.error('Service statistics error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
  
  // ===============================
  // 5. THỐNG KÊ VẬN HÀNH
  // ===============================
  
  async getOperationalStatistics(req, res) {
    try {
      // Hiệu suất chat support
      const chatStats = await ChatMessage.aggregate([
        {
          $lookup: {
            from: 'chatrooms',
            localField: 'room_id',
            foreignField: '_id',
            as: 'room'
          }
        },
        { $unwind: '$room' },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            averageResponseTime: { $avg: '$response_time' }, // Giả sử có trường này
            totalRooms: { $addToSet: '$room_id' }
          }
        },
        {
          $project: {
            totalMessages: 1,
            averageResponseTime: 1,
            totalRooms: { $size: '$totalRooms' }
          }
        }
      ]);
      
      // Sử dụng voucher
      const voucherUsage = await Order.aggregate([
        { $match: { voucher_id: { $ne: null } } },
        {
          $lookup: {
            from: 'vouchers',
            localField: 'voucher_id',
            foreignField: '_id',
            as: 'voucher'
          }
        },
        { $unwind: '$voucher' },
        {
          $group: {
            _id: '$voucher_id',
            voucherCode: { $first: '$voucher.code' },
            usageCount: { $sum: 1 },
            totalDiscount: { $sum: '$voucher.discount_amount' }
          }
        },
        { $sort: { usageCount: -1 } }
      ]);
      
      // Thống kê thanh toán theo phương thức
      const paymentMethods = await Order.aggregate([
        {
          $group: {
            _id: '$payment_method',
            count: { $sum: 1 },
            totalAmount: { $sum: '$total_amount' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Operational statistics retrieved successfully',
        data: {
          chatStats: chatStats[0] || {},
          voucherUsage,
          paymentMethods
        }
      });
    } catch (error) {
      console.error('Operational statistics error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
  
  // ===============================
  // 6. DASHBOARD TỔNG QUAN
  // ===============================
  
  async getDashboardOverview(req, res) {
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));
      
      // KPI chính hôm nay
      const todayRevenue = await Order.aggregate([
        {
          $match: {
            created_at: { $gte: startOfDay, $lte: endOfDay },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total_amount' },
            orderCount: { $sum: 1 }
          }
        }
      ]);
      
      const newCustomersToday = await User.countDocuments({
        role: 'Customer',
        created_at: { $gte: startOfDay, $lte: endOfDay }
      });
      
      // Cảnh báo
      const pendingOrders = await Order.countDocuments({
        status: 'pending',
        created_at: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // > 24h
      });
      
      const lowStockAlert = await Product.countDocuments({
        stock: { $lt: 5 } // < 5 sản phẩm
      });
      
      // Top performers hôm nay
      const todayTopProducts = await OrderItem.aggregate([
        {
          $lookup: {
            from: 'orders',
            localField: 'order_id',
            foreignField: '_id',
            as: 'order'
          }
        },
        { $unwind: '$order' },
        {
          $match: {
            'order.created_at': { $gte: startOfDay, $lte: endOfDay },
            'order.status': 'completed'
          }
        },
        {
          $group: {
            _id: { pet_id: '$pet_id', product_id: '$product_id' },
            quantity: { $sum: '$quantity' },
            revenue: { $sum: { $multiply: ['$quantity', '$unit_price'] } }
          }
        },
        { $sort: { quantity: -1 } },
        { $limit: 5 }
      ]);
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Dashboard overview retrieved successfully',
        data: {
          kpis: {
            todayRevenue: todayRevenue[0]?.totalRevenue || 0,
            todayOrders: todayRevenue[0]?.orderCount || 0,
            newCustomersToday
          },
          alerts: {
            pendingOrders,
            lowStockAlert
          },
          topPerformers: todayTopProducts
        }
      });
    } catch (error) {
      console.error('Dashboard overview error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
}

module.exports = new StatisticsController();