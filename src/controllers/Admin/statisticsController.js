// src/controllers/statisticsController.js - ENHANCED VERSION WITH COMPLETE DATA
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
const PetVariant = require('../../models/PetVariant');
const ProductImage = require('../../models/ProductImage');
const Image = require('../../models/ImagePet');
const Breed = require('../../models/Breed');

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
      
      console.log('🔍 Getting top selling items with params:', { limit, type });
      
      // Build match condition
      let matchCondition = {};
      if (type === 'pet') {
        matchCondition = { pet_id: { $ne: null } };
      } else if (type === 'product') {
        matchCondition = { product_id: { $ne: null } };
      } else if (type === 'variant') {
        matchCondition = { variant_id: { $ne: null } };
      }
      
      console.log('📋 Match condition:', matchCondition);
      
      // Get top selling items with proper aggregation
      const topItems = await OrderItem.aggregate([
        // Step 1: Join with orders and filter completed orders
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
        
        // Step 2: Group by item type and calculate totals
        {
          $group: {
            _id: {
              pet_id: '$pet_id',
              product_id: '$product_id',
              variant_id: '$variant_id'
            },
            totalQuantity: { $sum: '$quantity' },
            totalRevenue: { $sum: { $multiply: ['$quantity', '$unit_price'] } },
            orderCount: { $sum: 1 },
            averagePrice: { $avg: '$unit_price' }
          }
        },
        
        // Step 3: Sort by quantity sold
        { $sort: { totalQuantity: -1 } },
        { $limit: parseInt(limit) },
        
        // Step 4: Add item type classification
        {
          $addFields: {
            item_type: {
              $cond: {
                if: { $ne: ['$_id.variant_id', null] },
                then: 'variant',
                else: {
                  $cond: {
                    if: { $ne: ['$_id.pet_id', null] },
                    then: 'pet',
                    else: 'product'
                  }
                }
              }
            }
          }
        }
      ]);
      
      console.log('📊 Aggregation results before lookup:', topItems.length, 'items');
      
      // Step 5: Manually populate data for each item type
      const enrichedItems = await Promise.all(topItems.map(async (item) => {
        let itemData = { ...item };
        
        try {
          if (item.item_type === 'variant' && item._id.variant_id) {
            // Populate variant with pet info and images
            const variant = await PetVariant.findById(item._id.variant_id)
              .populate({
                path: 'pet_id',
                populate: {
                  path: 'breed_id',
                  select: 'name category_id',
                  populate: {
                    path: 'category_id',
                    select: 'name'
                  }
                }
              })
              .lean();
            
            if (variant && variant.pet_id) {
              // Get pet images
              const images = await Image.find({ pet_id: variant.pet_id._id }).lean();
              
              itemData.variant = {
                ...variant,
                pet_info: {
                  ...variant.pet_id,
                  images: images || []
                }
              };
              itemData.display_name = `${variant.pet_id.name} (${variant.color || 'N/A'})`;
              itemData.display_price = variant.pet_id.price + (variant.price_adjustment || 0);
            }
            
          } else if (item.item_type === 'pet' && item._id.pet_id) {
            // Populate pet with breed and images
            const pet = await Pet.findById(item._id.pet_id)
              .populate({
                path: 'breed_id',
                select: 'name category_id',
                populate: {
                  path: 'category_id',
                  select: 'name'
                }
              })
              .lean();
            
            if (pet) {
              // Get pet images
              const images = await Image.find({ pet_id: pet._id }).lean();
              
              itemData.pet = {
                ...pet,
                images: images || []
              };
              itemData.display_name = pet.name;
              itemData.display_price = pet.price;
            }
            
          } else if (item.item_type === 'product' && item._id.product_id) {
            // Populate product with category and images
            const product = await Product.findById(item._id.product_id)
              .populate('category_id', 'name')
              .lean();
            
            if (product) {
              // Get product images
              const images = await ProductImage.find({ product_id: product._id }).lean();
              
              itemData.product = {
                ...product,
                images: images || []
              };
              itemData.display_name = product.name;
              itemData.display_price = product.price;
            }
          }
          
          // Add calculated fields
          itemData.revenue_per_unit = itemData.totalRevenue / itemData.totalQuantity;
          itemData.performance_score = itemData.totalQuantity * 0.6 + (itemData.totalRevenue / 1000) * 0.4;
          
        } catch (populateError) {
          console.error(`❌ Error populating ${item.item_type}:`, populateError);
          itemData.error = `Failed to load ${item.item_type} details`;
        }
        
        return itemData;
      }));
      
      // Filter out items that couldn't be populated
      const validItems = enrichedItems.filter(item => 
        item.pet || item.product || item.variant || item.error
      );
      
      console.log('✅ Successfully processed', validItems.length, 'items');
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Top selling items retrieved successfully',
        metadata: {
          total_items: validItems.length,
          filter_type: type,
          limit: parseInt(limit)
        },
        data: validItems
      });
      
    } catch (error) {
      console.error('❌ Top selling items error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        data: null
      });
    }
  }

  // ===============================
  // 🚀 ENHANCED INVENTORY STATISTICS WITH 4 TABS
  // ===============================
  async getInventoryStatistics(req, res) {
    try {
      console.log('📦🔄 Getting ENHANCED inventory statistics with 4 tabs...');

      // ========================================
      // 1. 🐕 INVENTORY BY BREED (Enhanced)
      // ========================================
      const inventoryByBreed = await Pet.aggregate([
        {
          $lookup: {
            from: 'breeds',
            localField: 'breed_id',
            foreignField: '_id',
            as: 'breed'
          }
        },
        { $unwind: { path: '$breed', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'categories',
            localField: 'breed.category_id',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$breed._id',
            breedId: { $first: '$breed._id' },
            breedName: { $first: { $ifNull: ['$breed.name', 'Không xác định'] } },
            categoryName: { $first: { $ifNull: ['$category.name', 'Chưa phân loại'] } },
            categoryId: { $first: '$category._id' },
            
            // Thống kê số lượng
            totalPets: { $sum: 1 },
            availablePets: {
              $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
            },
            soldPets: {
              $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] }
            },
            
            // Thống kê giá cả
            averagePrice: { $avg: '$price' },
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            totalValue: { $sum: '$price' },
            
            // Thống kê bán hàng (pets còn available có khả năng bán)
            potentialRevenue: {
              $sum: {
                $cond: [{ $eq: ['$status', 'available'] }, '$price', 0]
              }
            }
          }
        },
        {
          $addFields: {
            // Tính tỷ lệ phần trăm
            availabilityRate: {
              $multiply: [
                { $divide: ['$availablePets', '$totalPets'] },
                100
              ]
            },
            soldRate: {
              $multiply: [
                { $divide: ['$soldPets', '$totalPets'] },
                100
              ]
            },
            priceRange: {
              $subtract: ['$maxPrice', '$minPrice']
            }
          }
        },
        { $sort: { totalPets: -1, breedName: 1 } }
      ]);

      // ========================================
      // 2. 📂 INVENTORY BY CATEGORY (New)
      // ========================================
      const inventoryByCategory = await Pet.aggregate([
        {
          $lookup: {
            from: 'breeds',
            localField: 'breed_id',
            foreignField: '_id',
            as: 'breed'
          }
        },
        { $unwind: { path: '$breed', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'categories',
            localField: 'breed.category_id',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$category._id',
            categoryId: { $first: '$category._id' },
            categoryName: { $first: { $ifNull: ['$category.name', 'Chưa phân loại'] } },
            description: { $first: '$category.description' },
            
            // Thống kê số lượng
            totalPets: { $sum: 1 },
            availablePets: {
              $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
            },
            soldPets: {
              $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] }
            },
            
            // Thống kê giá cả
            averagePrice: { $avg: '$price' },
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            totalValue: { $sum: '$price' },
            
            // Thống kê breed đa dạng
            uniqueBreeds: { $addToSet: '$breed._id' }
          }
        },
        {
          $addFields: {
            availabilityRate: {
              $multiply: [
                { $divide: ['$availablePets', '$totalPets'] },
                100
              ]
            },
            soldRate: {
              $multiply: [
                { $divide: ['$soldPets', '$totalPets'] },
                100
              ]
            },
            breedDiversity: { $size: '$uniqueBreeds' }
          }
        },
        {
          $project: {
            uniqueBreeds: 0 // Remove this field from output
          }
        },
        { $sort: { totalPets: -1, categoryName: 1 } }
      ]);

      // ========================================
      // 3. 🛍️ INVENTORY BY PRODUCT (New)
      // ========================================
      const inventoryByProduct = await Product.aggregate([
        {
          $lookup: {
            from: 'categories',
            localField: 'category_id',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        
        // Get sales data from OrderItems
        {
          $lookup: {
            from: 'orderitems',
            let: { productId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$product_id', '$$productId'] }
                }
              },
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
                  'order.status': 'completed'
                }
              }
            ],
            as: 'sales'
          }
        },
        
        {
          $addFields: {
            totalSold: {
              $sum: '$sales.quantity'
            },
            totalRevenue: {
              $sum: {
                $map: {
                  input: '$sales',
                  as: 'sale',
                  in: { $multiply: ['$$sale.quantity', '$$sale.unit_price'] }
                }
              }
            },
            totalStock: { $ifNull: ['$stock', 0] } // Assume stock field exists
          }
        },
        
        {
          $project: {
            _id: 1,
            productName: '$name',
            categoryName: { $ifNull: ['$category.name', 'Chưa phân loại'] },
            price: 1,
            totalSold: 1,
            totalStock: 1,
            totalRevenue: 1,
            description: 1,
            status: { $ifNull: ['$status', 'active'] }
          }
        },
        
        { $sort: { totalSold: -1, productName: 1 } }
      ]);

      // ========================================
      // 4. 🐾 TOP PETS SELLING (Enhanced)
      // ========================================
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
            totalRevenue: { $sum: { $multiply: ['$quantity', '$unit_price'] } },
            averagePrice: { $avg: '$unit_price' },
            orderCount: { $sum: 1 },
            uniqueCustomers: { $addToSet: '$order.user_id' }
          }
        },
        {
          $addFields: {
            customerCount: { $size: '$uniqueCustomers' },
            revenuePerCustomer: {
              $divide: ['$totalRevenue', { $size: '$uniqueCustomers' }]
            }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 20 }
      ]);

      // Populate pet details for top pets
      const populatedTopPets = await Promise.all(
        topPets.map(async (item) => {
          try {
            const pet = await Pet.findById(item._id)
              .populate({
                path: 'breed_id',
                select: 'name category_id',
                populate: {
                  path: 'category_id',
                  select: 'name'
                }
              })
              .lean();
            
            if (pet) {
              // Get pet images
              const images = await Image.find({ pet_id: pet._id }).lean();
              
              return {
                ...item,
                petName: pet.name,
                pet: {
                  ...pet,
                  images: images || []
                }
              };
            }
            return null;
          } catch (error) {
            console.error('Error populating pet:', error);
            return null;
          }
        })
      );

      const validTopPets = populatedTopPets.filter(item => item !== null);

      // ========================================
      // 5. 🚨 BREED ALERTS (Enhanced)
      // ========================================
      const breedAlerts = await Pet.aggregate([
        {
          $lookup: {
            from: 'breeds',
            localField: 'breed_id',
            foreignField: '_id',
            as: 'breed'
          }
        },
        { $unwind: { path: '$breed', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$breed._id',
            breedName: { $first: { $ifNull: ['$breed.name', 'Không xác định'] } },
            availableCount: {
              $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
            },
            totalCount: { $sum: 1 }
          }
        },
        {
          $match: {
            $or: [
              { availableCount: { $lte: 2 } }, // Ít hơn 2 con có sẵn
              { availableCount: 0 } // Hết hàng
            ]
          }
        },
        {
          $addFields: {
            alertLevel: {
              $cond: [
                { $eq: ['$availableCount', 0] },
                'critical', // Hết hàng hoàn toàn
                'warning'   // Sắp hết hàng
              ]
            }
          }
        },
        { $sort: { availableCount: 1 } }
      ]);

      // ========================================
      // 6. 📊 SUMMARY STATISTICS
      // ========================================
      const summary = {
        totalBreeds: inventoryByBreed.length,
        totalCategories: inventoryByCategory.length,
        totalProducts: inventoryByProduct.length,
        totalPets: inventoryByBreed.reduce((sum, breed) => sum + breed.totalPets, 0),
        totalAvailable: inventoryByBreed.reduce((sum, breed) => sum + breed.availablePets, 0),
        totalSold: inventoryByBreed.reduce((sum, breed) => sum + breed.soldPets, 0),
        totalValue: inventoryByBreed.reduce((sum, breed) => sum + breed.totalValue, 0),
        alertCount: breedAlerts.length,
        criticalAlerts: breedAlerts.filter(alert => alert.alertLevel === 'critical').length,
        
        // Product summary
        totalProductsSold: inventoryByProduct.reduce((sum, product) => sum + (product.totalSold || 0), 0),
        totalProductRevenue: inventoryByProduct.reduce((sum, product) => sum + (product.totalRevenue || 0), 0),
        
        // Category summary
        mostDiverseCategory: inventoryByCategory.reduce((prev, current) => 
          (current.breedDiversity > (prev.breedDiversity || 0)) ? current : prev, {}
        )
      };

      console.log('✅ ENHANCED inventory statistics compiled successfully');
      console.log(`📊 Found: ${inventoryByBreed.length} breeds, ${inventoryByCategory.length} categories, ${inventoryByProduct.length} products`);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Enhanced inventory statistics retrieved successfully',
        data: {
          // 🐕 Breed Tab Data
          inventoryByBreed,
          
          // 📂 Category Tab Data  
          inventoryByCategory,
          
          // 🛍️ Product Tab Data
          inventoryByProduct,
          
          // 🐾 Top Pets Tab Data
          topPets: validTopPets,
          
          // 🚨 Alerts
          breedAlerts,
          
          // 📊 Summary
          summary,

          // Legacy fields for backward compatibility
          petsByType: inventoryByCategory.map(cat => ({
            _id: cat.categoryName,
            count: cat.totalPets,
            averagePrice: cat.averagePrice,
            available: cat.availablePets,
            sold: cat.soldPets
          })),
          lowStockProducts: inventoryByProduct.filter(product => 
            (product.totalStock || 0) < 10
          ).slice(0, 10),
          variantStats: {
            totalVariants: 0, // Would need PetVariant aggregation
            availableVariants: 0,
            averagePriceAdjustment: 0,
            totalStock: 0
          }
        },
        metadata: {
          analysis_type: 'multi_tab_enhanced',
          total_breeds_analyzed: inventoryByBreed.length,
          total_categories_analyzed: inventoryByCategory.length,
          total_products_analyzed: inventoryByProduct.length,
          alert_count: breedAlerts.length,
          generated_at: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('❌ Enhanced inventory statistics error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        data: null
      });
    }
  }

  // Keep existing methods unchanged...
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
      
      let lowStockAlert = 0;
      try {
        lowStockAlert = await Product.countDocuments({
          stock: { $lt: 5 } // < 5 sản phẩm
        });
      } catch (error) {
        console.log('⚠️ Product stock field not available for low stock alert');
      }
      
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

  // ===============================
  // 🚀 ADDITIONAL ENHANCED METHODS
  // ===============================
  
  // Get breed trends and analytics
  async getBreedTrends(req, res) {
    try {
      const { months = 6 } = req.query;
      const monthsAgo = new Date(new Date().setMonth(new Date().getMonth() - parseInt(months)));
      
      const breedTrends = await Pet.aggregate([
        {
          $match: {
            created_at: { $gte: monthsAgo }
          }
        },
        {
          $lookup: {
            from: 'breeds',
            localField: 'breed_id',
            foreignField: '_id',
            as: 'breed'
          }
        },
        { $unwind: { path: '$breed', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              breedId: '$breed._id',
              breedName: '$breed.name',
              year: { $year: '$created_at' },
              month: { $month: '$created_at' }
            },
            count: { $sum: 1 },
            avgPrice: { $avg: '$price' }
          }
        },
        {
          $group: {
            _id: { breedId: '$_id.breedId', breedName: '$_id.breedName' },
            monthlyData: {
              $push: {
                month: '$_id.month',
                year: '$_id.year',
                count: '$count',
                avgPrice: '$avgPrice'
              }
            },
            totalAdded: { $sum: '$count' },
            overallAvgPrice: { $avg: '$avgPrice' }
          }
        },
        { $sort: { totalAdded: -1 } },
        { $limit: 10 }
      ]);
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Breed trends retrieved successfully',
        data: {
          breedTrends,
          period: `${months} months`,
          generated_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Breed trends error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Get product performance analytics
  async getProductPerformance(req, res) {
    try {
      const productPerformance = await Product.aggregate([
        {
          $lookup: {
            from: 'orderitems',
            let: { productId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$product_id', '$productId'] }
                }
              },
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
                  'order.status': 'completed'
                }
              }
            ],
            as: 'sales'
          }
        },
        {
          $addFields: {
            totalSold: { $sum: '$sales.quantity' },
            totalRevenue: {
              $sum: {
                $map: {
                  input: '$sales',
                  as: 'sale',
                  in: { $multiply: ['$sale.quantity', '$sale.unit_price'] }
                }
              }
            },
            totalOrders: { $size: '$sales' },
            performanceScore: {
              $add: [
                { $multiply: [{ $sum: '$sales.quantity' }, 0.4] },
                { $multiply: [{ $divide: [{ $sum: { $map: { input: '$sales', as: 'sale', in: { $multiply: ['$sale.quantity', '$sale.unit_price'] } } } }, 1000] }, 0.6] }
              ]
            }
          }
        },
        {
          $match: {
            totalSold: { $gt: 0 }
          }
        },
        { $sort: { performanceScore: -1 } },
        { $limit: 50 }
      ]);
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Product performance retrieved successfully',
        data: productPerformance
      });
    } catch (error) {
      console.error('Product performance error:', error);
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