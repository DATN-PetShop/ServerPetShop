// src/controllers/statisticsController.js - ENHANCED VERSION WITH COMPLETE DATA
const mongoose = require('mongoose');
const Order = require('../../models/Order');
const OrderItem = require('../../models/OrderItem');
const User = require('../../models/User');
const Pet = require('../../models/Pet');
const Product = require('../../models/Product');
const Category = require('../../models/Category');
const Appointment = require('../../models/Appointment');
const PetVariant = require('../../models/PetVariant');
const ProductImage = require('../../models/ProductImage');
const Image = require('../../models/ImagePet');
const Breed = require('../../models/Breed');

class StatisticsController {
  // 1. THỐNG KÊ DOANH THU VÀ BÁN HÀNG
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
  // 2. THỐNG KÊ TOP SẢN PHẨM BÁN CHẠY
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
// CẬP NHẬT THỐNG KÊ SẢN PHẨM VÀ THÚ CƯNG
  async getInventoryStatistics(req, res) {
    try {
      console.log('📊 Getting comprehensive inventory statistics...');

      // ===== 1. THỐNG KÊ THEO CATEGORY =====
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
          $lookup: {
            from: 'petvariants',
            localField: '_id',
            foreignField: 'pet_id',
            as: 'variants'
          }
        },
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
            totalVariants: { $sum: { $size: '$variants' } },
            allVariants: { $push: '$variants' }
          }
        },
        {
          $addFields: {
            averagePrice: {
              $avg: {
                $map: {
                  input: {
                    $reduce: {
                      input: '$allVariants',
                      initialValue: [],
                      in: { $concatArrays: ['$$value', '$$this'] }
                    }
                  },
                  in: '$$this.selling_price'
                }
              }
            }
          }
        },
        {
          $project: {
            allVariants: 0
          }
        }
      ]);

      // ===== 2. PETVARIANT COMPREHENSIVE STATISTICS =====
      const petVariantStats = await PetVariant.aggregate([
        {
          $lookup: {
            from: 'pets',
            localField: 'pet_id',
            foreignField: '_id',
            as: 'pet'
          }
        },
        { $unwind: '$pet' },
        {
          $lookup: {
            from: 'breeds',
            localField: 'pet.breed_id',
            foreignField: '_id',
            as: 'breed'
          }
        },
        {
          $lookup: {
            from: 'orderitems',
            let: { variantId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$variant_id', '$$variantId'] }
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
              { $match: { 'order.status': 'completed' } }
            ],
            as: 'soldItems'
          }
        },
        {
          $addFields: {
            actualSoldQuantity: { $sum: '$soldItems.quantity' },
            soldRevenue: {
              $sum: {
                $map: {
                  input: '$soldItems',
                  in: { $multiply: ['$$this.quantity', '$$this.unit_price'] }
                }
              }
            },
            finalPrice: { $add: ['$pet.price', '$price_adjustment'] }
          }
        },
        {
          $group: {
            _id: null,
            totalVariants: { $sum: 1 },
            availableVariants: {
              $sum: { $cond: [{ $eq: ['$is_available', true] }, 1, 0] }
            },
            totalVariantStock: { $sum: '$stock_quantity' },
            availableVariantStock: {
              $sum: { 
                $cond: [
                  { $and: [{ $eq: ['$is_available', true] }, { $gt: ['$stock_quantity', 0] }] },
                  '$stock_quantity',
                  0
                ]
              }
            },
            totalVariantsSold: { $sum: '$actualSoldQuantity' },
            uniqueVariantsSold: {
              $sum: { $cond: [{ $gt: ['$actualSoldQuantity', 0] }, 1, 0] }
            },
            totalVariantRevenue: { $sum: '$soldRevenue' },
            totalInventoryValue: {
              $sum: { $multiply: ['$stock_quantity', '$finalPrice'] }
            },
            availableInventoryValue: {
              $sum: { 
                $cond: [
                  { $and: [{ $eq: ['$is_available', true] }, { $gt: ['$stock_quantity', 0] }] },
                  { $multiply: ['$stock_quantity', '$finalPrice'] },
                  0
                ]
              }
            },
            totalBasePets: { $sum: 1 },
            availableBasePets: {
              $sum: { $cond: [{ $eq: ['$pet.status', 'available'] }, 1, 0] }
            },
            uniqueBreeds: { $addToSet: '$breed._id' }
          }
        },
        {
          $project: {
            totalVariants: 1,
            availableVariants: 1,
            totalVariantStock: 1,
            availableVariantStock: 1,
            totalVariantsSold: 1,
            uniqueVariantsSold: 1,
            totalVariantRevenue: 1,
            totalInventoryValue: 1,
            availableInventoryValue: 1,
            totalBasePets: 1,
            availableBasePets: 1,
            uniqueBreeds: { $size: '$uniqueBreeds' },
            variantTurnoverRate: {
              $cond: [
                { $gt: [{ $add: ['$totalVariantStock', '$totalVariantsSold'] }, 0] },
                {
                  $multiply: [
                    { 
                      $divide: [
                        '$totalVariantsSold', 
                        { $add: ['$totalVariantStock', '$totalVariantsSold'] }
                      ] 
                    },
                    100
                  ]
                },
                0
              ]
            },
            avgVariantPrice: {
              $cond: [
                { $gt: ['$totalVariantsSold', 0] },
                { $divide: ['$totalVariantRevenue', '$totalVariantsSold'] },
                0
              ]
            }
          }
        }
      ]);

      // ===== 3. TOP PETS =====
      const topPets = await Pet.aggregate([
        {
          $lookup: {
            from: 'orderitems',
            let: { petId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ['$pet_id', '$$petId'] },
                      { $ne: ['$variant_id', null] }
                    ]
                  }
                }
              },
              {
                $lookup: {
                  from: 'petvariants',
                  localField: 'variant_id',
                  foreignField: '_id',
                  as: 'variant'
                }
              },
              {
                $addFields: {
                  isPetSale: {
                    $or: [
                      { $eq: ['$pet_id', '$$petId'] },
                      { $eq: [{ $arrayElemAt: ['$variant.pet_id', 0] }, '$$petId'] }
                    ]
                  }
                }
              },
              { $match: { isPetSale: true } },
              {
                $lookup: {
                  from: 'orders',
                  localField: 'order_id',
                  foreignField: '_id',
                  as: 'order'
                }
              },
              { $unwind: '$order' },
              { $match: { 'order.status': 'completed' } }
            ],
            as: 'soldItems'
          }
        },
        {
          $addFields: {
            totalSold: { $sum: '$soldItems.quantity' },
            totalRevenue: {
              $sum: {
                $map: {
                  input: '$soldItems',
                  in: { $multiply: ['$$this.quantity', '$$this.unit_price'] }
                }
              }
            }
          }
        },
        {
          $match: {
            totalSold: { $gt: 0 }
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
        {
          $project: {
            _id: 1,
            name: 1,
            price: 1,
            type: 1,
            status: 1,
            breed: { $arrayElemAt: ['$breed', 0] },
            totalSold: 1,
            totalRevenue: 1,
            avgSalePrice: {
              $cond: [
                { $gt: ['$totalSold', 0] },
                { $divide: ['$totalRevenue', '$totalSold'] },
                0
              ]
            }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]);

      // ===== 4. TOP SELLING VARIANTS =====
      const topSellingVariants = await OrderItem.aggregate([
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
            'order.status': 'completed',
            variant_id: { $ne: null }
          }
        },
        {
          $group: {
            _id: '$variant_id',
            totalSold: { $sum: '$quantity' },
            totalRevenue: { $sum: { $multiply: ['$quantity', '$unit_price'] } },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'petvariants',
            localField: '_id',
            foreignField: '_id',
            as: 'variant'
          }
        },
        { $unwind: '$variant' },
        {
          $lookup: {
            from: 'pets',
            localField: 'variant.pet_id',
            foreignField: '_id',
            as: 'pet'
          }
        },
        { $unwind: '$pet' },
        {
          $project: {
            variant: 1,
            petInfo: '$pet',
            totalSold: 1,
            totalRevenue: 1,
            orderCount: 1,
            displayName: {
              $concat: [
                '$pet.name', 
                ' (', '$variant.color', 
                ' - ', { $toString: '$variant.weight' }, 'kg',
                ' - ', '$variant.gender',
                ' - ', { $toString: '$variant.age' }, ' tuổi)'
              ]
            }
          }
        }
      ]);

      // ===== 5. PETS BY TYPE =====
      const petsByType = await Pet.aggregate([
        {
          $lookup: {
            from: 'petvariants',
            localField: '_id',
            foreignField: 'pet_id',
            as: 'variants'
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            variantCount: { $sum: { $size: '$variants' } },
            averagePrice: { $avg: '$price' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // ===== 6. LOW STOCK ITEMS =====
      const lowStockVariants = await PetVariant.aggregate([
        { 
          $match: { 
            stock_quantity: { $lt: 5 },
            is_available: true
          } 
        },
        {
          $lookup: {
            from: 'pets',
            localField: 'pet_id',
            foreignField: '_id',
            as: 'pet'
          }
        },
        { $unwind: '$pet' },
        {
          $project: {
            petName: '$pet.name',
            color: 1,
            weight: 1,
            gender: 1,
            age: 1,
            stock_quantity: 1,
            selling_price: { $add: ['$pet.price', '$price_adjustment'] },
            sku: 1,
            type: { $literal: 'variant' },
            displayName: {
              $concat: [
                '$pet.name', 
                ' (', '$color', 
                ' - ', { $toString: '$weight' }, 'kg',
                ' - ', '$gender',
                ' - ', { $toString: '$age' }, ' tuổi)'
              ]
            }
          }
        },
        { $sort: { stock_quantity: 1 } },
        { $limit: 5 }
      ]);

      const lowStockProducts = await Product.aggregate([
        { 
          $match: { 
            stock: { $lt: 10 }
          } 
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'category_id',
            foreignField: '_id',
            as: 'category'
          }
        },
        {
          $project: {
            name: 1,
            stock: 1,
            price: 1,
            categoryName: { $arrayElemAt: ['$category.name', 0] },
            type: { $literal: 'product' },
            displayName: '$name'
          }
        },
        { $sort: { stock: 1 } },
        { $limit: 5 }
      ]);

      const lowStockItems = [...lowStockVariants, ...lowStockProducts]
        .sort((a, b) => (a.stock_quantity || a.stock) - (b.stock_quantity || b.stock))
        .slice(0, 10);

      // ===== 7. INVENTORY BY PRODUCT =====
      const inventoryByProduct = await Product.aggregate([
        {
          $lookup: {
            from: 'categories',
            localField: 'category_id',
            foreignField: '_id',
            as: 'category'
          }
        },
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
              { $match: { 'order.status': 'completed' } }
            ],
            as: 'completedOrders'
          }
        },
        {
          $addFields: {
            totalSold: {
              $sum: {
                $map: {
                  input: '$completedOrders',
                  in: '$$this.quantity'
                }
              }
            },
            totalRevenue: {
              $sum: {
                $map: {
                  input: '$completedOrders',
                  in: { $multiply: ['$$this.quantity', '$$this.unit_price'] }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: '$_id',
            productName: { $first: '$name' },
            categoryName: { $first: { $arrayElemAt: ['$category.name', 0] } },
            totalStock: { $first: '$stock' },
            price: { $first: '$price' },
            totalSold: { $first: '$totalSold' },
            totalRevenue: { $first: '$totalRevenue' }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 20 }
      ]);

      // ===== 8. INVENTORY BY BREED với totalVariantStock =====
      const inventoryByBreed = await Pet.aggregate([
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
          $lookup: {
            from: 'orderitems',
            let: { petId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ['$pet_id', '$$petId'] },
                      { $ne: ['$variant_id', null] }
                    ]
                  }
                }
              },
              {
                $lookup: {
                  from: 'petvariants',
                  localField: 'variant_id', 
                  foreignField: '_id',
                  as: 'variant'
                }
              },
              {
                $addFields: {
                  isPetItem: {
                    $or: [
                      { $eq: ['$pet_id', '$$petId'] },
                      { $eq: [{ $arrayElemAt: ['$variant.pet_id', 0] }, '$$petId'] }
                    ]
                  }
                }
              },
              { $match: { isPetItem: true } },
              {
                $lookup: {
                  from: 'orders',
                  localField: 'order_id',
                  foreignField: '_id',
                  as: 'order'
                }
              },
              { $unwind: '$order' },
              { $match: { 'order.status': 'completed' } }
            ],
            as: 'soldItems'
          }
        },
        {
          $lookup: {
            from: 'petvariants',
            localField: '_id',
            foreignField: 'pet_id',
            as: 'variants'
          }
        },
        {
          $group: {
            _id: '$breed._id',
            breedName: { $first: '$breed.name' },
            categoryName: { $first: '$category.name' },
            totalPets: { $sum: 1 },
            availablePets: {
              $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
            },
            totalVariants: { $sum: { $size: '$variants' } },
            totalVariantStock: {
              $sum: {
                $sum: {
                  $map: {
                    input: '$variants',
                    in: {
                      $cond: [
                        { $eq: ['$$this.is_available', true] },
                        { $ifNull: ['$$this.stock_quantity', 0] },
                        0
                      ]
                    }
                  }
                }
              }
            },
            availableVariantStock: {
              $sum: {
                $sum: {
                  $map: {
                    input: '$variants',
                    in: {
                      $cond: [
                        { 
                          $and: [
                            { $eq: ['$$this.is_available', true] },
                            { $gt: [{ $ifNull: ['$$this.stock_quantity', 0] }, 0] }
                          ]
                        },
                        { $ifNull: ['$$this.stock_quantity', 0] },
                        0
                      ]
                    }
                  }
                }
              }
            },
            soldPets: {
              $sum: {
                $cond: [
                  { $gt: [{ $size: '$soldItems' }, 0] },
                  1, 
                  { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] }
                ]
              }
            },
            soldQuantity: { $sum: { $sum: '$soldItems.quantity' } },
            allVariants: { $push: '$variants' }
          }
        },
        {
          $addFields: {
            averageVariantPrice: {
              $avg: {
                $map: {
                  input: {
                    $reduce: {
                      input: '$allVariants',
                      initialValue: [],
                      in: { $concatArrays: ['$$value', '$$this'] }
                    }
                  },
                  in: '$$this.selling_price'
                }
              }
            },
            stockUtilizationRate: {
              $cond: [
                { $gt: ['$totalVariantStock', 0] },
                {
                  $multiply: [
                    { 
                      $divide: [
                        { $subtract: ['$totalVariantStock', '$availableVariantStock'] }, 
                        '$totalVariantStock'
                      ] 
                    },
                    100
                  ]
                },
                0
              ]
            }
          }
        },
        {
          $project: {
            breedName: 1,
            categoryName: 1,
            totalPets: 1,
            availablePets: 1,
            totalVariants: 1,
            totalVariantStock: 1,
            availableVariantStock: 1,
            soldVariantStock: { $subtract: ['$totalVariantStock', '$availableVariantStock'] },
            soldPets: 1,
            soldQuantity: 1,
            averageVariantPrice: 1,
            stockUtilizationRate: 1,
            performance: {
              stockTurnover: '$stockUtilizationRate',
              averagePrice: '$averageVariantPrice',
              totalValue: { $multiply: ['$totalVariantStock', '$averageVariantPrice'] }
            }
          }
        },
        { $sort: { totalVariantStock: -1 } },
        { $limit: 20 }
      ]);

      // ===== 9. VARIANTS BY COLOR & GENDER =====
      const variantsByColor = await PetVariant.aggregate([
        {
          $group: {
            _id: '$color',
            count: { $sum: 1 },
            availableCount: {
              $sum: { $cond: [{ $eq: ['$is_available', true] }, 1, 0] }
            },
            totalStock: { $sum: '$stock_quantity' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      const variantsByGender = await PetVariant.aggregate([
        {
          $group: {
            _id: '$gender',
            count: { $sum: 1 },
            availableCount: {
              $sum: { $cond: [{ $eq: ['$is_available', true] }, 1, 0] }
            },
            avgAge: { $avg: '$age' },
            avgWeight: { $avg: '$weight' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // ===== 10. BREED ALERTS =====
      const breedAlerts = await Pet.aggregate([
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
          $group: {
            _id: '$breed._id',
            breedName: { $first: '$breed.name' },
            totalCount: { $sum: 1 },
            availableCount: {
              $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
            }
          }
        },
        {
          $addFields: {
            alertLevel: {
              $cond: {
                if: { $lte: ['$availableCount', 2] },
                then: 'critical',
                else: {
                  $cond: {
                    if: { $lte: ['$availableCount', 5] },
                    then: 'warning',
                    else: null
                  }
                }
              }
            }
          }
        },
        {
          $match: {
            alertLevel: { $ne: null }
          }
        },
        { $sort: { availableCount: 1 } }
      ]);

      // ===== 11. ENHANCED SUMMARY =====
      const variantData = petVariantStats[0] || {};
      const enhancedSummary = {
        totalCategories: inventoryByCategory.length,
        totalBreeds: inventoryByBreed.length,
        totalPets: variantData.totalBasePets || 0,
        totalAvailable: variantData.availableBasePets || 0,
        totalVariants: variantData.totalVariants || 0,
        availableVariants: variantData.availableVariants || 0,
        totalVariantStock: variantData.totalVariantStock || 0,
        availableVariantStock: variantData.availableVariantStock || 0,
        totalVariantsSold: variantData.totalVariantsSold || 0,
        uniqueVariantsSold: variantData.uniqueVariantsSold || 0,
        totalInventoryValue: variantData.totalInventoryValue || 0,
        availableInventoryValue: variantData.availableInventoryValue || 0,
        totalVariantRevenue: variantData.totalVariantRevenue || 0,
        variantTurnoverRate: variantData.variantTurnoverRate || 0,
        avgVariantPrice: variantData.avgVariantPrice || 0,
        alertCount: breedAlerts.length,
        lowStockCount: lowStockItems.length
      };

      console.log('✅ Enhanced inventory statistics completed:', {
        totalVariants: enhancedSummary.totalVariants,
        variantsSold: enhancedSummary.totalVariantsSold,
        turnoverRate: enhancedSummary.variantTurnoverRate.toFixed(2) + '%',
        topVariants: topSellingVariants.length
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Enhanced inventory statistics with breed variant stock retrieved successfully',
        data: {
          inventoryByCategory,
          inventoryByBreed,
          inventoryByProduct,
          topPets,
          petsByType,
          topSellingVariants,
          petVariantStats: variantData,
          variantsByColor,
          variantsByGender,
          lowStockProducts: lowStockItems,
          breedAlerts,
          summary: enhancedSummary,
          breedVariantSummary: {
            totalBreeds: inventoryByBreed.length,
            totalVariantStock: inventoryByBreed.reduce((sum, breed) => sum + breed.totalVariantStock, 0),
            totalAvailableStock: inventoryByBreed.reduce((sum, breed) => sum + breed.availableVariantStock, 0),
            topBreedsByStock: inventoryByBreed.slice(0, 5).map(breed => ({
              breedName: breed.breedName,
              totalVariantStock: breed.totalVariantStock,
              availableVariantStock: breed.availableVariantStock,
              utilizationRate: breed.stockUtilizationRate
            }))
          },
          debug: {
            topPetsCount: topPets.length,
            topVariantsCount: topSellingVariants.length,
            breedStatsCount: inventoryByBreed.length,
            lowStockCount: lowStockItems.length,
            calculationMethod: 'Enhanced with breed variant stock aggregation'
          }
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
// CẬP NHẬT THỐNG KÊ PROFIT/LỢI NHUẬN
  async getProfitOverview(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      let orderDateFilter = {};
      if (startDate || endDate) {
        orderDateFilter['order.created_at'] = {};
        if (startDate) orderDateFilter['order.created_at'].$gte = new Date(startDate);
        if (endDate) orderDateFilter['order.created_at'].$lte = new Date(endDate);
      }

      const profitData = await OrderItem.aggregate([
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
            'order.status': 'completed',
            ...orderDateFilter
          } 
        },
        
        // Lookup variant để lấy import_price
        {
          $lookup: {
            from: 'petvariants',
            localField: 'variant_id',
            foreignField: '_id',
            as: 'variant'
          }
        },
        
        // Lookup product để lấy cost_price (nếu có)
        {
          $lookup: {
            from: 'products',
            localField: 'product_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        
        {
          $addFields: {
            // Tính cost price: từ variant.import_price hoặc product.cost_price
            costPrice: {
              $cond: [
                { $gt: [{ $size: '$variant' }, 0] },
                { $ifNull: [{ $arrayElemAt: ['$variant.import_price', 0] }, 0] },
                {
                  $cond: [
                    { $gt: [{ $size: '$product' }, 0] },
                    { $ifNull: [{ $arrayElemAt: ['$product.cost_price', 0] }, 0] },
                    0
                  ]
                }
              ]
            }
          }
        },
        
        // Group để tính tổng
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $multiply: ['$quantity', '$unit_price'] } },
            totalCostPrice: { 
              $sum: { 
                $multiply: [
                  '$quantity', 
                  { $ifNull: ['$costPrice', 0] }
                ] 
              } 
            },
            uniqueOrders: { $addToSet: '$order_id' },
            totalItems: { $sum: '$quantity' }
          }
        },
        
        // Tính các metrics cuối cùng
        {
          $project: {
            totalRevenue: 1,
            totalCostPrice: 1,
            totalProfit: { $subtract: ['$totalRevenue', '$totalCostPrice'] },
            totalOrders: { $size: '$uniqueOrders' },
            totalItems: 1,
            profitMargin: {
              $cond: [
                { $gt: ['$totalRevenue', 0] },
                { 
                  $multiply: [
                    { 
                      $divide: [
                        { $subtract: ['$totalRevenue', '$totalCostPrice'] }, 
                        '$totalRevenue'
                      ] 
                    },
                    100
                  ]
                },
                0
              ]
            },
            averageOrderValue: {
              $cond: [
                { $gt: [{ $size: '$uniqueOrders' }, 0] },
                { 
                  $divide: [
                    '$totalRevenue', 
                    { $size: '$uniqueOrders' }
                  ] 
                },
                0
              ]
            }
          }
        }
      ]);

      const result = profitData[0] || {
        totalRevenue: 0,
        totalCostPrice: 0,
        totalProfit: 0,
        profitMargin: 0,
        totalOrders: 0,
        totalItems: 0,
        averageOrderValue: 0
      };

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Profit overview retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Profit overview error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
// LẤY THỐNG KÊ LỢI NHUẬN THEO SẢN PHẨM
  async getProfitByProducts(req, res) {
    try {
      const { startDate, endDate, limit = 10, type = 'all' } = req.query;
      
      let dateFilter = {};
      if (startDate || endDate) {
        dateFilter.created_at = {};
        if (startDate) dateFilter.created_at.$gte = new Date(startDate);
        if (endDate) dateFilter.created_at.$lte = new Date(endDate);
      }

      let matchCondition = {};
      if (type === 'pet') {
        matchCondition = { 
          $or: [
            { pet_id: { $ne: null } },
            { variant_id: { $ne: null } }
          ]
        };
      } else if (type === 'product') {
        matchCondition = { 
          product_id: { $ne: null },
          variant_id: null,
          pet_id: null
        };
      }

      const profitByProducts = await OrderItem.aggregate([
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
            'order.status': 'completed',
            ...dateFilter,
            ...matchCondition
          } 
        },
        
        // Lookup variant
        {
          $lookup: {
            from: 'petvariants',
            localField: 'variant_id',
            foreignField: '_id',
            as: 'variant'
          }
        },
        
        // Lookup product
        {
          $lookup: {
            from: 'products',
            localField: 'product_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        
        // Lookup pet
        {
          $lookup: {
            from: 'pets',
            localField: 'pet_id',
            foreignField: '_id',
            as: 'pet'
          }
        },
        
        {
          $addFields: {
            costPrice: {
              $cond: {
                if: { $ne: ['$variant_id', null] },
                then: { $arrayElemAt: ['$variant.import_price', 0] },
                else: { 
                  $cond: {
                    if: { $ne: ['$product_id', null] },
                    then: { $arrayElemAt: ['$product.cost_price', 0] },
                    else: 0
                  }
                }
              }
            },
            
            // Tạo identifier cho group
            groupId: {
              $cond: {
                if: { $ne: ['$variant_id', null] },
                then: { variant_id: '$variant_id' },
                else: {
                  $cond: {
                    if: { $ne: ['$pet_id', null] },
                    then: { pet_id: '$pet_id' },
                    else: { product_id: '$product_id' }
                  }
                }
              }
            },
            
            // Tạo thông tin item
            itemInfo: {
              $cond: {
                if: { $ne: ['$variant_id', null] },
                then: {
                  $mergeObjects: [
                    { $arrayElemAt: ['$variant', 0] },
                    { 
                      type: 'variant',
                      petInfo: { $arrayElemAt: ['$pet', 0] }
                    }
                  ]
                },
                else: {
                  $cond: {
                    if: { $ne: ['$pet_id', null] },
                    then: {
                      $mergeObjects: [
                        { $arrayElemAt: ['$pet', 0] },
                        { type: 'pet' }
                      ]
                    },
                    else: {
                      $mergeObjects: [
                        { $arrayElemAt: ['$product', 0] },
                        { type: 'product' }
                      ]
                    }
                  }
                }
              }
            }
          }
        },
        
        {
          $group: {
            _id: '$groupId',
            totalRevenue: { $sum: { $multiply: ['$quantity', '$unit_price'] } },
            totalCostPrice: { $sum: { $multiply: ['$quantity', '$costPrice'] } },
            totalQuantity: { $sum: '$quantity' },
            itemInfo: { $first: '$itemInfo' }
          }
        },
        
        {
          $addFields: {
            totalProfit: { $subtract: ['$totalRevenue', '$totalCostPrice'] },
            profitMargin: {
              $cond: {
                if: { $gt: ['$totalRevenue', 0] },
                then: { 
                  $multiply: [
                    { $divide: [{ $subtract: ['$totalRevenue', '$totalCostPrice'] }, '$totalRevenue'] },
                    100
                  ]
                },
                else: 0
              }
            }
          }
        },
        
        { $sort: { totalProfit: -1 } },
        { $limit: parseInt(limit) }
      ]);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Profit by products retrieved successfully',
        data: profitByProducts
      });
    } catch (error) {
      console.error('Profit by products error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
// 1. THỐNG KÊ TỒN KHO HIỆN TẠI
  async getCurrentInventoryValue(req, res) {
    try {
      // Tính tổng giá trị kho từ variants
      const variantValue = await PetVariant.aggregate([
        { $match: { is_available: true } },
        {
          $group: {
            _id: null,
            totalValue: { 
              $sum: { $multiply: ['$selling_price', '$stock_quantity'] } 
            },
            totalVariants: { $sum: 1 },
            totalStock: { $sum: '$stock_quantity' }
          }
        }
      ]);

      // Tính giá trị theo pets
      const petValue = await Pet.aggregate([
        {
          $lookup: {
            from: 'petvariants',
            localField: '_id',
            foreignField: 'pet_id',
            as: 'variants'
          }
        },
        {
          $addFields: {
            petValue: {
              $sum: {
                $map: {
                  input: '$variants',
                  in: { $multiply: ['$$this.selling_price', '$$this.stock_quantity'] }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalValue: { $sum: '$petValue' },
            totalPets: { $sum: 1 }
          }
        }
      ]);

      // Tính giá trị products
      const productValue = await Product.aggregate([
        {
          $group: {
            _id: null,
            totalValue: { 
              $sum: { $multiply: ['$price', '$stock'] } 
            },
            totalProducts: { $sum: 1 },
            totalStock: { $sum: '$stock' }
          }
        }
      ]);

      const variantData = variantValue[0] || { totalValue: 0, totalVariants: 0, totalStock: 0 };
      const petData = petValue[0] || { totalValue: 0, totalPets: 0 };
      const productData = productValue[0] || { totalValue: 0, totalProducts: 0, totalStock: 0 };

      const result = {
        summary: {
          totalInventoryValue: variantData.totalValue + productData.totalValue,
          totalItems: variantData.totalVariants + productData.totalProducts,
          totalStock: variantData.totalStock + productData.totalStock
        },
        pets: {
          totalValue: petData.totalValue,
          totalPets: petData.totalPets
        },
        variants: {
          totalValue: variantData.totalValue,
          totalVariants: variantData.totalVariants,
          totalStock: variantData.totalStock
        },
        products: {
          totalValue: productData.totalValue,
          totalProducts: productData.totalProducts,
          totalStock: productData.totalStock
        }
      };

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Current inventory value retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Inventory value error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
  // 2. THỐNG KÊ TRẠNG THÁI ĐƠN HÀNG
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
  // 2. THỐNG KÊ KHÁCH HÀNG
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
      
      console.log('📊 Getting customer statistics with dateFilter:', dateFilter);
      
      // 🔧 FIX: Sử dụng role: 'User' thay vì 'Customer' theo schema
      const totalCustomers = await User.countDocuments({ role: 'User' });
      console.log('👥 Total customers found:', totalCustomers);
      
      // Khách hàng mới theo thời gian - 🔧 FIX: role: 'User'
      const newCustomers = await User.aggregate([
        { $match: { role: 'User', ...dateFilter } },
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
      console.log('🆕 New customers by period:', newCustomers.length, 'periods');
      
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
        // 🔧 FIX: Thêm filter để chỉ lấy users có role: 'User'
        {
          $match: {
            'customer.role': 'User'
          }
        },
        {
          $project: {
            customerInfo: {
              id: '$customer._id',
              username: '$customer.username',
              email: '$customer.email',
              role: '$customer.role', // Thêm để debug
              phone: '$customer.phone',
              avatar_url: '$customer.avatar_url',
              status: '$customer.status'
            },
            totalSpent: 1,
            orderCount: 1,
            averageOrderValue: 1
          }
        }
      ]);
      console.log('💰 High value customers found:', highValueCustomers.length);
      
      // Tỷ lệ khách hàng quay lại - 🔧 FIX: Thêm lookup để filter role
      const returningCustomers = await Order.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        // 🔧 FIX: Chỉ lấy orders của users có role: 'User'
        {
          $match: {
            'user.role': 'User'
          }
        },
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
              $cond: [
                { $gt: ['$totalCustomers', 0] },
                {
                  $multiply: [
                    { $divide: ['$returningCustomers', '$totalCustomers'] },
                    100
                  ]
                },
                0
              ]
            }
          }
        }
      ]);
      
      console.log('🔄 Return rate data:', returningCustomers);
      
      // 🆕 THÊM: Thống kê chi tiết hơn
      const customersByStatus = await User.aggregate([
        { $match: { role: 'User' } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      // 🆕 THÊM: Khách hàng theo tháng (12 tháng gần nhất)
      const last12Months = new Date();
      last12Months.setMonth(last12Months.getMonth() - 12);
      
      const customerGrowth = await User.aggregate([
        { 
          $match: { 
            role: 'User',
            created_at: { $gte: last12Months }
          } 
        },
        {
          $group: {
            _id: {
              year: { $year: '$created_at' },
              month: { $month: '$created_at' }
            },
            newCustomers: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);
      
      // 🆕 THÊM: Top khách hàng theo số đơn hàng
      const topCustomersByOrders = await Order.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        { $match: { 'user.role': 'User' } },
        {
          $group: {
            _id: '$user_id',
            orderCount: { $sum: 1 },
            totalSpent: { $sum: '$total_amount' },
            customerInfo: { $first: '$user' }
          }
        },
        { $sort: { orderCount: -1 } },
        { $limit: 10 },
        {
          $project: {
            customerInfo: {
              id: '$customerInfo._id',
              username: '$customerInfo.username',
              email: '$customerInfo.email',
              phone: '$customerInfo.phone'
            },
            orderCount: 1,
            totalSpent: 1,
            averageOrderValue: { $divide: ['$totalSpent', '$orderCount'] }
          }
        }
      ]);
      
      console.log('✅ Customer statistics completed successfully');
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Customer statistics retrieved successfully',
        data: {
          // Dữ liệu cơ bản
          totalCustomers,
          newCustomers,
          highValueCustomers,
          returnRate: returningCustomers[0] || { 
            totalCustomers: 0, 
            returningCustomers: 0, 
            returnRate: 0 
          },
          
          // 🆕 Dữ liệu mở rộng
          customersByStatus,
          customerGrowth,
          topCustomersByOrders,
          
          // Metadata
          metadata: {
            dateFilter: dateFilter,
            generatedAt: new Date().toISOString(),
            totalActiveCustomers: customersByStatus.find(s => s._id === 'active')?.count || 0,
            totalInactiveCustomers: customersByStatus.find(s => s._id === 'inactive')?.count || 0
          }
        }
      });
    } catch (error) {
      console.error('❌ Customer statistics error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        data: null
      });
    }
  }
  // 4. THỐNG KÊ DỊCH VỤ
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
  // 6. DASHBOARD TỔNG QUAN
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
// 7. THỐNG KÊ TỪNG GIỐNG THÚ CƯNG
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
// 8. THỐNG KÊ HIỆU SUẤT SẢN PHẨM
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

async getProfitByPeriod(req, res) {
  try {
    const { startDate, endDate, period = 'day' } = req.query;
    
    let matchStage = {
      status: { $in: ['completed', 'delivered'] }
    };

    if (startDate || endDate) {
      matchStage.created_at = {};
      if (startDate) matchStage.created_at.$gte = new Date(startDate);
      if (endDate) matchStage.created_at.$lte = new Date(endDate);
    }

    // Định nghĩa group stage theo period
    let groupByPeriod;
    switch (period) {
      case 'day':
        groupByPeriod = {
          year: { $year: '$created_at' },
          month: { $month: '$created_at' },
          day: { $dayOfMonth: '$created_at' }
        };
        break;
      case 'week':
        groupByPeriod = {
          year: { $year: '$created_at' },
          week: { $week: '$created_at' }
        };
        break;
      case 'month':
        groupByPeriod = {
          year: { $year: '$created_at' },
          month: { $month: '$created_at' }
        };
        break;
      case 'year':
        groupByPeriod = {
          year: { $year: '$created_at' }
        };
        break;
      default:
        groupByPeriod = {
          year: { $year: '$created_at' },
          month: { $month: '$created_at' },
          day: { $dayOfMonth: '$created_at' }
        };
    }

    console.log(`📊 Getting profit by ${period} with filter:`, matchStage);

    const profitByPeriod = await Order.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'orderitems',
          localField: '_id',
          foreignField: 'order_id',
          as: 'items'
        }
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'pets',
          localField: 'items.pet_id',
          foreignField: '_id',
          as: 'pet'
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $lookup: {
          from: 'petvariants',
          localField: 'items.variant_id',
          foreignField: '_id',
          as: 'variant'
        }
      },
      {
        $addFields: {
          // 🔧 FIX: Sử dụng purchase_price cho Product
          itemCostPrice: {
            $cond: [
              { $gt: [{ $size: '$pet' }, 0] },
              { $multiply: ['$items.quantity', { $arrayElemAt: ['$pet.price', 0] }] },
              {
                $cond: [
                  { $gt: [{ $size: '$product' }, 0] },
                  // 🔧 FIX: Dùng purchase_price thay vì price * 0.7
                  { 
                    $multiply: [
                      '$items.quantity', 
                      {
                        $ifNull: [
                          { $arrayElemAt: ['$product.purchase_price', 0] },
                          { $multiply: [{ $arrayElemAt: ['$product.price', 0] }, 0.7] } // Fallback
                        ]
                      }
                    ] 
                  },
                  {
                    $cond: [
                      { $gt: [{ $size: '$variant' }, 0] },
                      { $multiply: ['$items.quantity', { $arrayElemAt: ['$pet.price', 0] }] },
                      { $multiply: ['$items.quantity', { $multiply: ['$items.unit_price', 0.7] }] }
                    ]
                  }
                ]
              }
            ]
          },
          itemRevenue: { $multiply: ['$items.quantity', '$items.unit_price'] }
        }
      },
      {
        $group: {
          _id: groupByPeriod,
          totalRevenue: { $sum: '$itemRevenue' },
          totalCostPrice: { $sum: '$itemCostPrice' },
          totalOrders: { $addToSet: '$_id' },
          totalItems: { $sum: '$items.quantity' }
        }
      },
      {
        $project: {
          _id: 1,
          totalRevenue: 1,
          totalCostPrice: 1,
          totalProfit: { $subtract: ['$totalRevenue', '$totalCostPrice'] },
          profitMargin: {
            $cond: [
              { $gt: ['$totalRevenue', 0] },
              {
                $multiply: [
                  { $divide: [{ $subtract: ['$totalRevenue', '$totalCostPrice'] }, '$totalRevenue'] },
                  100
                ]
              },
              0
            ]
          },
          totalOrders: { $size: '$totalOrders' },
          totalItems: 1
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
    ]);

    console.log(`✅ Found ${profitByPeriod.length} periods with profit data`);

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Profit by period retrieved successfully',
      data: profitByPeriod
    });

  } catch (error) {
    console.error('❌ Profit by period error:', error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
      data: null
    });
  }
}

  async getDashboardProfitSummary(req, res) {
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));
      
      // Profit hôm nay
      const todayProfit = await Order.aggregate([
        {
          $match: {
            created_at: { $gte: startOfDay, $lte: endOfDay },
            status: { $in: ['completed', 'delivered'] }
          }
        },
        {
          $lookup: {
            from: 'orderitems',
            localField: '_id',
            foreignField: 'order_id',
            as: 'items'
          }
        },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'pets',
            localField: 'items.pet_id',
            foreignField: '_id',
            as: 'pet'
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        {
          $addFields: {
            // 🔧 FIX: Sử dụng purchase_price cho Product
            itemCostPrice: {
              $cond: [
                { $gt: [{ $size: '$pet' }, 0] },
                { $multiply: ['$items.quantity', { $arrayElemAt: ['$pet.price', 0] }] },
                // 🔧 FIX: Dùng purchase_price thay vì price * 0.7
                { 
                  $multiply: [
                    '$items.quantity', 
                    {
                      $ifNull: [
                        { $arrayElemAt: ['$product.purchase_price', 0] },
                        { $multiply: [{ $arrayElemAt: ['$product.price', 0] }, 0.7] } // Fallback
                      ]
                    }
                  ] 
                }
              ]
            },
            itemRevenue: { $multiply: ['$items.quantity', '$items.unit_price'] }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$itemRevenue' },
            totalCostPrice: { $sum: '$itemCostPrice' }
          }
        },
        {
          $project: {
            totalRevenue: 1,
            totalCostPrice: 1,
            totalProfit: { $subtract: ['$totalRevenue', '$totalCostPrice'] },
            profitMargin: {
              $cond: [
                { $gt: ['$totalRevenue', 0] },
                {
                  $multiply: [
                    { $divide: [{ $subtract: ['$totalRevenue', '$totalCostPrice'] }, '$totalRevenue'] },
                    100
                  ]
                },
                0
              ]
            }
          }
        }
      ]);
      
      const result = todayProfit[0] || {
        totalRevenue: 0,
        totalCostPrice: 0,
        totalProfit: 0,
        profitMargin: 0
      };
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Dashboard profit summary retrieved successfully',
        data: result
      });
      
    } catch (error) {
      console.error('Dashboard profit summary error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
 // Fixed exportStatisticalReport method
async exportStatisticalReport(req, res) {
  try {
    // Tạo mock res object đầy đủ để tránh lỗi
    const mockRes = {
      status: (code) => ({
        json: (data) => data
      }),
      json: (data) => data
    };

    // Hoặc gọi trực tiếp aggregation thay vì gọi method
    // Cách 1: Sử dụng mock res
    const revenueData = await this.getRevenueStatistics(req, mockRes);
    const topSellingData = await this.getTopSellingItems(req, mockRes);
    const orderStatusData = await this.getOrderStatusStatistics(req, mockRes);
    // ... các method khác

    // Hoặc Cách 2: Tách logic aggregation ra helper methods
    const reportData = await this.generateReportData(req);

    // Define CSV fields
    const fields = [
      { label: 'Section', value: 'section' },
      { label: 'Metric', value: 'metric' },
    ];

    // Import json2csv nếu chưa có
    const { Parser } = require('json2csv');
    
    // Generate CSV
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(reportData);

    // Set response headers for CSV download
    res.header('Content-Type', 'text/csv');
    res.attachment(`statistical-report-${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(csv);
  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Lỗi khi xuất báo cáo thống kê',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

// Cách 2: Tạo helper method để generate data mà không cần res
async generateReportData(req) {
  const reportData = [];
  
  try {
    // Revenue Statistics - Gọi trực tiếp aggregation
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
    
    // Import models
    const Order = require('../../models/Order');
    const OrderItem = require('../../models/OrderItem');
    const User = require('../../models/User');
    const Product = require('../../models/Product');
    
    // Revenue data
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

    // Add revenue data to report
    revenueByTime.forEach((item) => {
      reportData.push({
        section: 'Revenue Statistics',
        metric: `totalRevenue: ${item.totalRevenue || 0}, period: ${item._id ? `${item._id.year}-${item._id.month || item._id.week || item._id.day || ''}` : 'N/A'}, orders: ${item.totalOrders || 0}`,
      });
    });

    // Top selling items data
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
      { $match: { 'order.status': 'completed' } },
      {
        $group: {
          _id: {
            pet_id: '$pet_id',
            product_id: '$product_id',
            variant_id: '$variant_id'
          },
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: { $multiply: ['$quantity', '$unit_price'] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    // Add top selling data to report
    topItems.forEach((item, index) => {
      reportData.push({
        section: 'Top Selling Items',
        metric: `rank: ${index + 1}, quantity: ${item.totalQuantity || 0}, revenue: ${item.totalRevenue || 0}, type: ${item._id.variant_id ? 'variant' : item._id.pet_id ? 'pet' : 'product'}`,
      });
    });

    // Order status data
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

    // Add order status data to report
    statusStats.forEach((status) => {
      reportData.push({
        section: 'Order Status',
        metric: `status: ${status._id || 'N/A'}, count: ${status.count || 0}, totalValue: ${status.totalValue || 0}`,
      });
    });

    // Customer statistics
    const totalCustomers = await User.countDocuments({ role: 'User' });
    const newCustomers = await User.countDocuments({ 
      role: 'User', 
      ...dateFilter 
    });

    reportData.push({
      section: 'Customer Statistics',
      metric: `totalCustomers: ${totalCustomers}, newCustomers: ${newCustomers}`,
    });

    return reportData;

  } catch (error) {
    console.error('Error generating report data:', error);
    throw error;
  }
}

  // ===== 1. THỐNG KÊ DOANH THU THEO NGÀY =====
  async getDailyStatistics(req, res) {
    try {
      const { startDate, endDate, limit = 30 } = req.query;
      
      // Mặc định lấy 30 ngày gần nhất nếu không có filter
      const endDateFilter = endDate ? new Date(endDate) : new Date();
      const startDateFilter = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      console.log('📅 Getting daily statistics from', startDateFilter, 'to', endDateFilter);
      
      const dailyStats = await Order.aggregate([
        {
          $match: {
            created_at: { $gte: startDateFilter, $lte: endDateFilter },
            status: { $in: ['completed', 'delivered'] }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$created_at' },
              month: { $month: '$created_at' },
              day: { $dayOfMonth: '$created_at' },
              dayOfWeek: { $dayOfWeek: '$created_at' }
            },
            totalRevenue: { $sum: '$total_amount' },
            totalOrders: { $sum: 1 },
            averageOrderValue: { $avg: '$total_amount' },
            totalCustomers: { $addToSet: '$user_id' }
          }
        },
        {
          $addFields: {
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: '$_id.day'
              }
            },
            dayName: {
              $switch: {
                branches: [
                  { case: { $eq: ['$_id.dayOfWeek', 1] }, then: 'Chủ nhật' },
                  { case: { $eq: ['$_id.dayOfWeek', 2] }, then: 'Thứ 2' },
                  { case: { $eq: ['$_id.dayOfWeek', 3] }, then: 'Thứ 3' },
                  { case: { $eq: ['$_id.dayOfWeek', 4] }, then: 'Thứ 4' },
                  { case: { $eq: ['$_id.dayOfWeek', 5] }, then: 'Thứ 5' },
                  { case: { $eq: ['$_id.dayOfWeek', 6] }, then: 'Thứ 6' },
                  { case: { $eq: ['$_id.dayOfWeek', 7] }, then: 'Thứ 7' }
                ],
                default: 'N/A'
              }
            },
            uniqueCustomers: { $size: '$totalCustomers' }
          }
        },
        { $sort: { date: -1 } },
        { $limit: parseInt(limit) }
      ]);
      
      // Thống kê items bán ra theo ngày
      const dailyItemStats = await OrderItem.aggregate([
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
            'order.created_at': { $gte: startDateFilter, $lte: endDateFilter },
            'order.status': { $in: ['completed', 'delivered'] }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$order.created_at' },
              month: { $month: '$order.created_at' },
              day: { $dayOfMonth: '$order.created_at' }
            },
            totalItems: { $sum: '$quantity' },
            uniqueProducts: { $addToSet: { 
              pet_id: '$pet_id', 
              product_id: '$product_id', 
              variant_id: '$variant_id' 
            }},
            petsSold: { $sum: { $cond: [{ $ne: ['$pet_id', null] }, '$quantity', 0] }},
            productsSold: { $sum: { $cond: [{ $ne: ['$product_id', null] }, '$quantity', 0] }},
            variantsSold: { $sum: { $cond: [{ $ne: ['$variant_id', null] }, '$quantity', 0] }}
          }
        },
        {
          $addFields: {
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: '$_id.day'
              }
            },
            uniqueProductCount: { $size: '$uniqueProducts' }
          }
        },
        { $sort: { date: -1 } }
      ]);
      
      // Merge data
      const mergedStats = dailyStats.map(stat => {
        const itemStat = dailyItemStats.find(item => 
          item._id.year === stat._id.year && 
          item._id.month === stat._id.month && 
          item._id.day === stat._id.day
        );
        
        return {
          ...stat,
          itemStats: itemStat || {
            totalItems: 0,
            uniqueProductCount: 0,
            petsSold: 0,
            productsSold: 0,
            variantsSold: 0
          }
        };
      });
      
      // Summary
      const summary = {
        totalDays: dailyStats.length,
        totalRevenue: dailyStats.reduce((sum, day) => sum + day.totalRevenue, 0),
        totalOrders: dailyStats.reduce((sum, day) => sum + day.totalOrders, 0),
        averageDailyRevenue: dailyStats.length > 0 ? 
          dailyStats.reduce((sum, day) => sum + day.totalRevenue, 0) / dailyStats.length : 0,
        bestDay: dailyStats.length > 0 ? 
          dailyStats.reduce((best, current) => 
            current.totalRevenue > best.totalRevenue ? current : best
          ) : null,
        worstDay: dailyStats.length > 0 ? 
          dailyStats.reduce((worst, current) => 
            current.totalRevenue < worst.totalRevenue ? current : worst
          ) : null
      };
      
      console.log('✅ Daily statistics completed:', {
        days: dailyStats.length,
        totalRevenue: summary.totalRevenue,
        avgDaily: summary.averageDailyRevenue
      });
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Daily statistics retrieved successfully',
        data: {
          dailyStats: mergedStats,
          summary,
          period: {
            from: startDateFilter.toISOString().split('T')[0],
            to: endDateFilter.toISOString().split('T')[0],
            days: dailyStats.length
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Daily statistics error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        data: null
      });
    }
  }

  // ===== 2. THỐNG KÊ THEO THÁNG =====
  async getMonthlyStatistics(req, res) {
    try {
      const { year, months = 12 } = req.query;
      const currentYear = year ? parseInt(year) : new Date().getFullYear();
      
      console.log('📊 Getting monthly statistics for year:', currentYear);
      
      const monthlyStats = await Order.aggregate([
        {
          $match: {
            created_at: {
              $gte: new Date(`${currentYear}-01-01`),
              $lte: new Date(`${currentYear}-12-31T23:59:59.999Z`)
            },
            status: { $in: ['completed', 'delivered'] }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$created_at' },
              month: { $month: '$created_at' }
            },
            totalRevenue: { $sum: '$total_amount' },
            totalOrders: { $sum: 1 },
            averageOrderValue: { $avg: '$total_amount' },
            uniqueCustomers: { $addToSet: '$user_id' },
            maxOrderValue: { $max: '$total_amount' },
            minOrderValue: { $min: '$total_amount' }
          }
        },
        {
          $addFields: {
            monthName: {
              $switch: {
                branches: [
                  { case: { $eq: ['$_id.month', 1] }, then: 'Tháng 1' },
                  { case: { $eq: ['$_id.month', 2] }, then: 'Tháng 2' },
                  { case: { $eq: ['$_id.month', 3] }, then: 'Tháng 3' },
                  { case: { $eq: ['$_id.month', 4] }, then: 'Tháng 4' },
                  { case: { $eq: ['$_id.month', 5] }, then: 'Tháng 5' },
                  { case: { $eq: ['$_id.month', 6] }, then: 'Tháng 6' },
                  { case: { $eq: ['$_id.month', 7] }, then: 'Tháng 7' },
                  { case: { $eq: ['$_id.month', 8] }, then: 'Tháng 8' },
                  { case: { $eq: ['$_id.month', 9] }, then: 'Tháng 9' },
                  { case: { $eq: ['$_id.month', 10] }, then: 'Tháng 10' },
                  { case: { $eq: ['$_id.month', 11] }, then: 'Tháng 11' },
                  { case: { $eq: ['$_id.month', 12] }, then: 'Tháng 12' }
                ],
                default: 'N/A'
              }
            },
            uniqueCustomerCount: { $size: '$uniqueCustomers' }
          }
        },
        { $sort: { '_id.month': 1 } }
      ]);
      
      // Thống kê chi tiết items theo tháng
      const monthlyItemStats = await OrderItem.aggregate([
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
            'order.created_at': {
              $gte: new Date(`${currentYear}-01-01`),
              $lte: new Date(`${currentYear}-12-31T23:59:59.999Z`)
            },
            'order.status': { $in: ['completed', 'delivered'] }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$order.created_at' },
              month: { $month: '$order.created_at' }
            },
            totalItems: { $sum: '$quantity' },
            totalItemRevenue: { $sum: { $multiply: ['$quantity', '$unit_price'] }},
            petsSold: { $sum: { $cond: [{ $ne: ['$pet_id', null] }, '$quantity', 0] }},
            productsSold: { $sum: { $cond: [{ $ne: ['$product_id', null] }, '$quantity', 0] }},
            variantsSold: { $sum: { $cond: [{ $ne: ['$variant_id', null] }, '$quantity', 0] }},
            avgItemPrice: { $avg: '$unit_price' }
          }
        },
        { $sort: { '_id.month': 1 } }
      ]);
      
      // Lấy tháng trước để so sánh
      const previousYearStats = await Order.aggregate([
        {
          $match: {
            created_at: {
              $gte: new Date(`${currentYear - 1}-01-01`),
              $lte: new Date(`${currentYear - 1}-12-31T23:59:59.999Z`)
            },
            status: { $in: ['completed', 'delivered'] }
          }
        },
        {
          $group: {
            _id: {
              month: { $month: '$created_at' }
            },
            totalRevenue: { $sum: '$total_amount' },
            totalOrders: { $sum: 1 }
          }
        }
      ]);
      
      // Merge và tính growth
      const enrichedStats = monthlyStats.map(stat => {
        const itemStat = monthlyItemStats.find(item => 
          item._id.month === stat._id.month
        );
        
        const previousStat = previousYearStats.find(prev => 
          prev._id.month === stat._id.month
        );
        
        const revenueGrowth = previousStat ? 
          ((stat.totalRevenue - previousStat.totalRevenue) / previousStat.totalRevenue * 100) : 0;
        
        const orderGrowth = previousStat ? 
          ((stat.totalOrders - previousStat.totalOrders) / previousStat.totalOrders * 100) : 0;
        
        return {
          ...stat,
          itemStats: itemStat || {
            totalItems: 0,
            petsSold: 0,
            productsSold: 0,
            variantsSold: 0,
            totalItemRevenue: 0,
            avgItemPrice: 0
          },
          growth: {
            revenueGrowth: Math.round(revenueGrowth * 100) / 100,
            orderGrowth: Math.round(orderGrowth * 100) / 100,
            previousYearRevenue: previousStat?.totalRevenue || 0,
            previousYearOrders: previousStat?.totalOrders || 0
          }
        };
      });
      
      // Tổng kết năm
      const yearSummary = {
        year: currentYear,
        totalMonths: monthlyStats.length,
        totalRevenue: monthlyStats.reduce((sum, month) => sum + month.totalRevenue, 0),
        totalOrders: monthlyStats.reduce((sum, month) => sum + month.totalOrders, 0),
        averageMonthlyRevenue: monthlyStats.length > 0 ? 
          monthlyStats.reduce((sum, month) => sum + month.totalRevenue, 0) / monthlyStats.length : 0,
        bestMonth: monthlyStats.length > 0 ? 
          monthlyStats.reduce((best, current) => 
            current.totalRevenue > best.totalRevenue ? current : best
          ) : null,
        worstMonth: monthlyStats.length > 0 ? 
          monthlyStats.reduce((worst, current) => 
            current.totalRevenue < worst.totalRevenue ? current : worst
          ) : null,
        totalItems: enrichedStats.reduce((sum, month) => sum + (month.itemStats?.totalItems || 0), 0)
      };
      
      console.log('✅ Monthly statistics completed:', {
        year: currentYear,
        months: monthlyStats.length,
        totalRevenue: yearSummary.totalRevenue
      });
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Monthly statistics retrieved successfully',
        data: {
          monthlyStats: enrichedStats,
          yearSummary,
          metadata: {
            year: currentYear,
            previousYear: currentYear - 1,
            hasGrowthComparison: previousYearStats.length > 0
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Monthly statistics error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        data: null
      });
    }
  }

  // ===== 3. THỐNG KÊ THEO NĂM =====
  async getYearlyStatistics(req, res) {
    try {
      const { startYear, endYear, limit = 5 } = req.query;
      const currentYear = new Date().getFullYear();
      const fromYear = startYear ? parseInt(startYear) : currentYear - parseInt(limit) + 1;
      const toYear = endYear ? parseInt(endYear) : currentYear;
      
      console.log('📈 Getting yearly statistics from', fromYear, 'to', toYear);
      
      const yearlyStats = await Order.aggregate([
        {
          $match: {
            created_at: {
              $gte: new Date(`${fromYear}-01-01`),
              $lte: new Date(`${toYear}-12-31T23:59:59.999Z`)
            },
            status: { $in: ['completed', 'delivered'] }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$created_at' }
            },
            totalRevenue: { $sum: '$total_amount' },
            totalOrders: { $sum: 1 },
            averageOrderValue: { $avg: '$total_amount' },
            uniqueCustomers: { $addToSet: '$user_id' },
            maxOrderValue: { $max: '$total_amount' },
            minOrderValue: { $min: '$total_amount' },
            ordersByMonth: {
              $push: {
                month: { $month: '$created_at' },
                amount: '$total_amount'
              }
            }
          }
        },
        {
          $addFields: {
            uniqueCustomerCount: { $size: '$uniqueCustomers' },
            customerRetentionRate: {
              $multiply: [
                { $divide: [{ $size: '$uniqueCustomers' }, '$totalOrders'] },
                100
              ]
            }
          }
        },
        { $sort: { '_id.year': -1 } }
      ]);
      
      // Thống kê items theo năm
      const yearlyItemStats = await OrderItem.aggregate([
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
            'order.created_at': {
              $gte: new Date(`${fromYear}-01-01`),
              $lte: new Date(`${toYear}-12-31T23:59:59.999Z`)
            },
            'order.status': { $in: ['completed', 'delivered'] }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$order.created_at' }
            },
            totalItems: { $sum: '$quantity' },
            totalItemRevenue: { $sum: { $multiply: ['$quantity', '$unit_price'] }},
            petsSold: { $sum: { $cond: [{ $ne: ['$pet_id', null] }, '$quantity', 0] }},
            productsSold: { $sum: { $cond: [{ $ne: ['$product_id', null] }, '$quantity', 0] }},
            variantsSold: { $sum: { $cond: [{ $ne: ['$variant_id', null] }, '$quantity', 0] }},
            avgItemPrice: { $avg: '$unit_price' },
            uniqueItems: {
              $addToSet: {
                pet_id: '$pet_id',
                product_id: '$product_id', 
                variant_id: '$variant_id'
              }
            }
          }
        },
        {
          $addFields: {
            uniqueItemCount: { $size: '$uniqueItems' }
          }
        },
        { $sort: { '_id.year': -1 } }
      ]);
      
      // Thống kê khách hàng mới theo năm
      const yearlyCustomerStats = await User.aggregate([
        {
          $match: {
            role: 'User',
            created_at: {
              $gte: new Date(`${fromYear}-01-01`),
              $lte: new Date(`${toYear}-12-31T23:59:59.999Z`)
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$created_at' }
            },
            newCustomers: { $sum: 1 },
            customersByMonth: {
              $push: {
                month: { $month: '$created_at' },
                count: 1
              }
            }
          }
        },
        { $sort: { '_id.year': -1 } }
      ]);
      
      // Merge data và tính growth
      const enrichedStats = yearlyStats.map((stat, index) => {
        const itemStat = yearlyItemStats.find(item => 
          item._id.year === stat._id.year
        );
        
        const customerStat = yearlyCustomerStats.find(customer => 
          customer._id.year === stat._id.year
        );
        
        // Tính growth so với năm trước
        const previousYearStat = yearlyStats.find(prev => 
          prev._id.year === stat._id.year - 1
        );
        
        const revenueGrowth = previousYearStat ? 
          ((stat.totalRevenue - previousYearStat.totalRevenue) / previousYearStat.totalRevenue * 100) : 0;
        
        const orderGrowth = previousYearStat ? 
          ((stat.totalOrders - previousYearStat.totalOrders) / previousYearStat.totalOrders * 100) : 0;
        
        return {
          ...stat,
          itemStats: itemStat || {
            totalItems: 0,
            petsSold: 0,
            productsSold: 0,
            variantsSold: 0,
            totalItemRevenue: 0,
            avgItemPrice: 0,
            uniqueItemCount: 0
          },
          customerStats: customerStat || {
            newCustomers: 0
          },
          growth: {
            revenueGrowth: Math.round(revenueGrowth * 100) / 100,
            orderGrowth: Math.round(orderGrowth * 100) / 100,
            previousYear: stat._id.year - 1,
            previousYearRevenue: previousYearStat?.totalRevenue || 0,
            previousYearOrders: previousYearStat?.totalOrders || 0
          }
        };
      });
      
      // Tổng kết nhiều năm
      const overallSummary = {
        period: `${fromYear} - ${toYear}`,
        totalYears: yearlyStats.length,
        totalRevenue: yearlyStats.reduce((sum, year) => sum + year.totalRevenue, 0),
        totalOrders: yearlyStats.reduce((sum, year) => sum + year.totalOrders, 0),
        averageYearlyRevenue: yearlyStats.length > 0 ? 
          yearlyStats.reduce((sum, year) => sum + year.totalRevenue, 0) / yearlyStats.length : 0,
        bestYear: yearlyStats.length > 0 ? 
          yearlyStats.reduce((best, current) => 
            current.totalRevenue > best.totalRevenue ? current : best
          ) : null,
        worstYear: yearlyStats.length > 0 ? 
          yearlyStats.reduce((worst, current) => 
            current.totalRevenue < worst.totalRevenue ? current : worst
          ) : null,
        totalItems: enrichedStats.reduce((sum, year) => sum + (year.itemStats?.totalItems || 0), 0),
        totalNewCustomers: enrichedStats.reduce((sum, year) => sum + (year.customerStats?.newCustomers || 0), 0),
        compoundGrowthRate: yearlyStats.length > 1 ? 
          Math.pow(yearlyStats[0].totalRevenue / yearlyStats[yearlyStats.length - 1].totalRevenue, 1 / (yearlyStats.length - 1)) - 1 : 0
      };
      
      console.log('✅ Yearly statistics completed:', {
        years: yearlyStats.length,
        totalRevenue: overallSummary.totalRevenue,
        avgYearly: overallSummary.averageYearlyRevenue
      });
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Yearly statistics retrieved successfully',
        data: {
          yearlyStats: enrichedStats,
          overallSummary,
          metadata: {
            fromYear,
            toYear,
            currentYear,
            hasMultiYearComparison: yearlyStats.length > 1
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Yearly statistics error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        data: null
      });
    }
  }

}


const controller = new StatisticsController();
module.exports = {
  getRevenueStatistics: controller.getRevenueStatistics.bind(controller),
  getTopSellingItems: controller.getTopSellingItems.bind(controller),
  getOrderStatusStatistics: controller.getOrderStatusStatistics.bind(controller),
  getCustomerStatistics: controller.getCustomerStatistics.bind(controller),
  getInventoryStatistics: controller.getInventoryStatistics.bind(controller),
  getServiceStatistics: controller.getServiceStatistics.bind(controller),
  getDashboardOverview: controller.getDashboardOverview.bind(controller),
  getProductPerformance: controller.getProductPerformance.bind(controller),
  getProfitOverview: controller.getProfitOverview.bind(controller),
  getProfitByPeriod: controller.getProfitByPeriod.bind(controller),
  getProfitByProducts: controller.getProfitByProducts.bind(controller),
  getCurrentInventoryValue: controller.getCurrentInventoryValue.bind(controller),
  getDashboardProfitSummary: controller.getDashboardProfitSummary.bind(controller),
  exportStatisticalReport: controller.exportStatisticalReport.bind(controller),
  getBreedTrends: controller.getBreedTrends.bind(controller),
  getDailyStatistics: controller.getDailyStatistics.bind(controller),
  getMonthlyStatistics: controller.getMonthlyStatistics.bind(controller),
  getYearlyStatistics: controller.getYearlyStatistics.bind(controller),
};