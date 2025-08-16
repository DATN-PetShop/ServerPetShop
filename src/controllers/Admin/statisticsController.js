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

async getInventoryStatistics(req, res) {
  try {
    console.log('📦🔄 Getting COMPREHENSIVE inventory statistics...');

    // ========================================
    // 🔧 FIX 1: TỰ DYNAMIC GET SOLD PETS DATA TỪ ORDERITEMS
    // ========================================
    
    // Lấy dữ liệu bán hàng thực tế từ OrderItems
    const soldPetsData = await OrderItem.aggregate([
      {
        $match: {
          pet_id: { $ne: null } // Chỉ lấy OrderItem có pet_id
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
          'order.status': { $in: ['completed', 'delivered'] } // Chỉ tính đơn hoàn thành
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
        $lookup: {
          from: 'breeds',
          localField: 'pet.breed_id',
          foreignField: '_id',
          as: 'breed'
        }
      },
      { $unwind: { path: '$breed', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            breedId: '$breed._id',
            breedName: '$breed.name'
          },
          soldPetsCount: { $sum: '$quantity' }, // 🔧 FIX: Tính theo quantity
          soldPetIds: { $addToSet: '$pet_id' }, // Track unique pet IDs sold
          totalRevenue: { $sum: { $multiply: ['$quantity', '$unit_price'] } }
        }
      },
      {
        $project: {
          breedId: '$_id.breedId',
          breedName: '$_id.breedName',
          soldPetsCount: 1,
          uniquePetsSold: { $size: '$soldPetIds' }, // Number of unique pets sold
          totalRevenue: 1
        }
      }
    ]);

    console.log('📊 Sold pets data:', soldPetsData.length, 'breeds with sales');

    // Tạo map để lookup nhanh
    const soldPetsMap = new Map();
    soldPetsData.forEach(item => {
      if (item.breedId) {
        soldPetsMap.set(item.breedId.toString(), {
          soldPetsCount: item.soldPetsCount,
          uniquePetsSold: item.uniquePetsSold,
          totalRevenue: item.totalRevenue
        });
      }
    });

    // ========================================
    // 🔧 FIX 2: INVENTORY BY BREED - Kết hợp data thực tế
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
          
          // Thống kê số lượng từ Pet collection
          totalPets: { $sum: 1 },
          availablePets: {
            $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
          },
          reservedPets: {
            $sum: { $cond: [{ $eq: ['$status', 'reserved'] }, 1, 0] }
          },
          
          // Thống kê giá cả
          averagePrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          totalValue: { $sum: '$price' },
          
          // Collect pet IDs for debugging
          allPetIds: { $addToSet: '$_id' }
        }
      },
      {
        $project: {
          breedId: 1,
          breedName: 1,
          categoryName: 1,
          categoryId: 1,
          totalPets: 1,
          availablePets: 1,
          reservedPets: 1,
          averagePrice: 1,
          minPrice: 1,
          maxPrice: 1,
          totalValue: 1,
          allPetIds: 1
        }
      },
      { $sort: { totalPets: -1, breedName: 1 } }
    ]);

    // 🔧 FIX 3: Merge sold data với inventory data
    const enrichedInventoryByBreed = inventoryByBreed.map(breed => {
      const breedIdStr = breed.breedId ? breed.breedId.toString() : null;
      const soldData = breedIdStr ? soldPetsMap.get(breedIdStr) : null;
      
      return {
        ...breed,
        // 🔧 FIX: Sử dụng dữ liệu bán hàng thực tế
        soldPets: soldData ? soldData.soldPetsCount : 0,
        uniquePetsSold: soldData ? soldData.uniquePetsSold : 0,
        soldRevenue: soldData ? soldData.totalRevenue : 0,
        
        // Tính toán các tỷ lệ
        availabilityRate: breed.totalPets > 0 
          ? Math.round((breed.availablePets / breed.totalPets) * 100) 
          : 0,
        soldRate: breed.totalPets > 0 && soldData 
          ? Math.round((soldData.soldPetsCount / breed.totalPets) * 100) 
          : 0,
        priceRange: breed.maxPrice - breed.minPrice,
        
        // Revenue per pet sold
        averageRevenuePerPet: soldData && soldData.soldPetsCount > 0
          ? Math.round(soldData.totalRevenue / soldData.soldPetsCount)
          : 0
      };
    });

    console.log(`✅ Breed analysis: Found ${enrichedInventoryByBreed.length} breeds`);
    
    // Debug log để kiểm tra
    const breedsWithSales = enrichedInventoryByBreed.filter(breed => breed.soldPets > 0);
    console.log(`🎯 Breeds with actual sales: ${breedsWithSales.length}`);
    if (breedsWithSales.length > 0) {
      console.log('📋 Sample breeds with sales:', breedsWithSales.slice(0, 3).map(b => ({
        name: b.breedName,
        total: b.totalPets,
        sold: b.soldPets,
        revenue: b.soldRevenue
      })));
    }

    // ========================================
    // 🔧 FIX 4: INVENTORY BY CATEGORY - Tính lại soldPets
    // ========================================
    const inventoryByCategory = enrichedInventoryByBreed.reduce((acc, breed) => {
      const existingCategory = acc.find(cat => cat.categoryName === breed.categoryName);
      
      if (existingCategory) {
        existingCategory.totalPets += breed.totalPets;
        existingCategory.availablePets += breed.availablePets;
        existingCategory.soldPets += breed.soldPets; // 🔧 FIX: Cộng dồn từ breed data
        existingCategory.reservedPets += breed.reservedPets;
        existingCategory.totalValue += breed.totalValue;
        existingCategory.soldRevenue += breed.soldRevenue;
        existingCategory.breeds.push(breed.breedName);
      } else {
        acc.push({
          _id: breed.categoryId,
          categoryId: breed.categoryId,
          categoryName: breed.categoryName,
          totalPets: breed.totalPets,
          availablePets: breed.availablePets,
          soldPets: breed.soldPets, // 🔧 FIX: Từ breed data
          reservedPets: breed.reservedPets,
          totalValue: breed.totalValue,
          soldRevenue: breed.soldRevenue,
          breeds: [breed.breedName],
          breedCount: 1
        });
      }
      return acc;
    }, []);

    // Tính average price và các metrics cho category
    inventoryByCategory.forEach(category => {
      category.averagePrice = category.totalPets > 0 
        ? Math.round(category.totalValue / category.totalPets) 
        : 0;
      category.availabilityRate = category.totalPets > 0 
        ? Math.round((category.availablePets / category.totalPets) * 100) 
        : 0;
      category.soldRate = category.totalPets > 0 
        ? Math.round((category.soldPets / category.totalPets) * 100) 
        : 0;
      category.breedCount = category.breeds.length;
    });

    console.log(`✅ Category analysis: Found ${inventoryByCategory.length} categories`);

    // ========================================
    // REST OF THE CODE UNCHANGED...
    // ========================================
    
    // Keep existing product inventory logic
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
          totalStock: { $ifNull: ['$stock', 0] },
          salesCount: { $size: '$sales' }
        }
      },
      
      {
        $project: {
          _id: 1,
          productName: '$name',
          categoryName: { $ifNull: ['$category.name', 'Chưa phân loại'] },
          categoryId: '$category._id',
          price: 1,
          totalSold: 1,
          totalStock: 1,
          totalRevenue: 1,
          salesCount: 1,
          description: 1,
          status: { $ifNull: ['$status', 'active'] },
          created_at: 1
        }
      },
      
      { $sort: { totalSold: -1, productName: 1 } }
    ]);

    console.log(`✅ Product analysis: Found ${inventoryByProduct.length} products`);

    // Keep existing top pets logic but use actual sold data
    const topPets = soldPetsData
      .sort((a, b) => b.soldPetsCount - a.soldPetsCount)
      .slice(0, 20);

    // Populate pet details for top pets
    const populatedTopPets = await Promise.all(
      topPets.map(async (item) => {
        try {
          const pets = await Pet.find({ breed_id: item.breedId })
            .populate({
              path: 'breed_id',
              select: 'name category_id',
              populate: {
                path: 'category_id',
                select: 'name'
              }
            })
            .limit(1)
            .lean();
          
          if (pets.length > 0) {
            const pet = pets[0];
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
    console.log(`✅ Top pets analysis: Found ${validTopPets.length} selling pets`);

    // Keep existing alert logic
    const breedAlerts = enrichedInventoryByBreed.filter(breed => 
      breed.availablePets <= 2 || breed.availablePets === 0
    ).map(breed => ({
      _id: breed.breedId,
      breedName: breed.breedName,
      availableCount: breed.availablePets,
      totalCount: breed.totalPets,
      soldCount: breed.soldPets,
      alertLevel: breed.availablePets === 0 ? 'critical' : 'warning',
      availabilityPercentage: breed.availabilityRate
    }));

    console.log(`✅ Alert analysis: Found ${breedAlerts.length} breeds needing attention`);

    // ========================================
    // 🔧 FIX 5: UPDATED SUMMARY với dữ liệu chính xác
    // ========================================
    
    // Get total counts from database directly for accuracy
    const [totalBreedsCount, totalCategoriesCount, totalProductsCount, totalPetsCount] = await Promise.all([
      Breed.countDocuments(),
      Category.countDocuments(),
      Product.countDocuments(),
      Pet.countDocuments()
    ]);

    // Calculate derived statistics với sold data thực tế
    const summary = {
      // Core counts
      totalBreeds: totalBreedsCount,
      totalCategories: totalCategoriesCount, 
      totalProducts: totalProductsCount,
      totalPets: totalPetsCount,
      
      // Pet status breakdown - 🔧 FIX: từ enriched data
      totalAvailable: enrichedInventoryByBreed.reduce((sum, breed) => sum + breed.availablePets, 0),
      totalSold: enrichedInventoryByBreed.reduce((sum, breed) => sum + breed.soldPets, 0), // 🔧 FIX
      totalReserved: enrichedInventoryByBreed.reduce((sum, breed) => sum + breed.reservedPets, 0),
      
      // Financial metrics
      totalValue: enrichedInventoryByBreed.reduce((sum, breed) => sum + breed.totalValue, 0),
      averagePetPrice: enrichedInventoryByBreed.length > 0 
        ? enrichedInventoryByBreed.reduce((sum, breed) => sum + breed.averagePrice, 0) / enrichedInventoryByBreed.length 
        : 0,
      totalSoldRevenue: enrichedInventoryByBreed.reduce((sum, breed) => sum + breed.soldRevenue, 0), // 🔧 FIX
      
      // Alert metrics
      alertCount: breedAlerts.length,
      criticalAlerts: breedAlerts.filter(alert => alert.alertLevel === 'critical').length,
      warningAlerts: breedAlerts.filter(alert => alert.alertLevel === 'warning').length,
      
      // Product metrics
      totalProductsSold: inventoryByProduct.reduce((sum, product) => sum + (product.totalSold || 0), 0),
      totalProductRevenue: inventoryByProduct.reduce((sum, product) => sum + (product.totalRevenue || 0), 0),
      activeProducts: inventoryByProduct.filter(product => product.status === 'active').length,
      lowStockProducts: inventoryByProduct.filter(product => (product.totalStock || 0) < 10).length,
      
      // Performance metrics - 🔧 FIX
      overallAvailabilityRate: totalPetsCount > 0 
        ? Math.round((enrichedInventoryByBreed.reduce((sum, breed) => sum + breed.availablePets, 0) / totalPetsCount) * 100) 
        : 0,
      overallSoldRate: totalPetsCount > 0 
        ? Math.round((enrichedInventoryByBreed.reduce((sum, breed) => sum + breed.soldPets, 0) / totalPetsCount) * 100) 
        : 0
    };

    console.log('✅ COMPREHENSIVE inventory statistics compiled successfully');
    console.log(`📊 Summary: ${totalCategoriesCount} categories, ${totalBreedsCount} breeds, ${totalPetsCount} pets`);
    console.log(`🎯 Sales: ${summary.totalSold} pets sold, ${summary.overallSoldRate}% sold rate`);

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Comprehensive inventory statistics retrieved successfully with accurate sold data',
      data: {
        // 🐕 Breed Tab Data - 🔧 FIX: với soldPets chính xác
        inventoryByBreed: enrichedInventoryByBreed,
        
        // 📂 Category Tab Data - 🔧 FIX: với soldPets tính lại  
        inventoryByCategory,
        
        // 🛍️ Product Tab Data
        inventoryByProduct,
        
        // 🐾 Top Pets Tab Data
        topPets: validTopPets,
        
        // 🚨 Alerts
        breedAlerts,
        
        // 📊 Summary - 🔧 FIX: với sold data chính xác
        summary,
        
        // Debug info
        debug: {
          totalSoldEntries: soldPetsData.length,
          breedsWithSales: breedsWithSales.length,
          soldPetsCalculationMethod: 'from_order_items'
        }
      },
      metadata: {
        analysis_type: 'comprehensive_multi_tab_with_accurate_sold_data',
        calculation_method: 'order_items_based_sold_calculation',
        data_sources: {
          pets_analyzed: totalPetsCount,
          breeds_analyzed: totalBreedsCount,
          categories_analyzed: totalCategoriesCount,
          products_analyzed: totalProductsCount,
          sold_data_entries: soldPetsData.length
        },
        alert_summary: {
          total_alerts: breedAlerts.length,
          critical_alerts: breedAlerts.filter(alert => alert.alertLevel === 'critical').length,
          warning_alerts: breedAlerts.filter(alert => alert.alertLevel === 'warning').length
        },
        performance_metrics: {
          overall_availability_rate: summary.overallAvailabilityRate,
          overall_sold_rate: summary.overallSoldRate,
          total_revenue_from_pets: summary.totalSoldRevenue
        },
        generated_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Comprehensive inventory statistics error:', error);
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


// 🔧 FIXED: 4 hàm đã được sửa để sử dụng purchase_price cho Product

async getProfitOverview(req, res) {
  try {
    const { startDate, endDate } = req.query;
    
    let matchStage = {
      status: { $in: ['completed', 'delivered'] } // Chỉ tính đơn hàng hoàn thành
    };

    if (startDate || endDate) {
      matchStage.created_at = {};
      if (startDate) matchStage.created_at.$gte = new Date(startDate);
      if (endDate) matchStage.created_at.$lte = new Date(endDate);
    }

    console.log('💰 Getting profit overview with filter:', matchStage);

    // Aggregate để tính tổng quan vốn và lời
    const overview = await Order.aggregate([
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
          // 🔧 FIX: Tính giá vốn cho từng item với purchase_price
          itemCostPrice: {
            $cond: [
              { $gt: [{ $size: '$pet' }, 0] },
              // Pet: dùng Pet.price làm cost price (giá nhập)
              { $multiply: ['$items.quantity', { $arrayElemAt: ['$pet.price', 0] }] },
              {
                $cond: [
                  { $gt: [{ $size: '$product' }, 0] },
                  // 🔧 FIX: Product - dùng purchase_price thay vì price * 0.7
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
                      // Variant: lookup pet để lấy price
                      { $multiply: ['$items.quantity', { $arrayElemAt: ['$pet.price', 0] }] },
                      // Fallback: estimate 70% of unit_price
                      { $multiply: ['$items.quantity', { $multiply: ['$items.unit_price', 0.7] }] }
                    ]
                  }
                ]
              }
            ]
          },
          // Doanh thu cho từng item = unit_price * quantity
          itemRevenue: { $multiply: ['$items.quantity', '$items.unit_price'] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$itemRevenue' },
          totalCostPrice: { $sum: '$itemCostPrice' },
          totalOrders: { $addToSet: '$_id' },
          totalItems: { $sum: '$items.quantity' }
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
          },
          totalOrders: { $size: '$totalOrders' },
          totalItems: 1,
          averageOrderValue: { 
            $cond: [
              { $gt: [{ $size: '$totalOrders' }, 0] },
              { $divide: ['$totalRevenue', { $size: '$totalOrders' }] },
              0
            ]
          }
        }
      }
    ]);

    const result = overview[0] || {
      totalRevenue: 0,
      totalCostPrice: 0,
      totalProfit: 0,
      profitMargin: 0,
      totalOrders: 0,
      totalItems: 0,
      averageOrderValue: 0
    };

    console.log('✅ Profit overview result:', result);

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Profit overview retrieved successfully',
      data: result
    });

  } catch (error) {
    console.error('❌ Profit overview error:', error);
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

  async getProfitByProducts(req, res) {
    try {
      const { limit = 20, type = 'all' } = req.query;
      
      console.log(`🛍️ Getting profit by products (${type}, limit: ${limit})`);

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
            'order.status': { $in: ['completed', 'delivered'] }
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
        {
          $lookup: {
            from: 'products',
            localField: 'product_id',
            foreignField: '_id',
            as: 'product'
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
            itemType: {
              $cond: [
                { $gt: [{ $size: '$pet' }, 0] }, 'pet',
                {
                  $cond: [
                    { $gt: [{ $size: '$product' }, 0] }, 'product',
                    'variant'
                  ]
                }
              ]
            },
            itemInfo: {
              $cond: [
                { $gt: [{ $size: '$pet' }, 0] },
                { $arrayElemAt: ['$pet', 0] },
                {
                  $cond: [
                    { $gt: [{ $size: '$product' }, 0] },
                    { $arrayElemAt: ['$product', 0] },
                    { $arrayElemAt: ['$variant', 0] }
                  ]
                }
              ]
            },
            // 🔧 FIX: Sử dụng purchase_price cho Product
            itemCostPrice: {
              $cond: [
                { $gt: [{ $size: '$pet' }, 0] },
                { $multiply: ['$quantity', { $arrayElemAt: ['$pet.price', 0] }] },
                {
                  $cond: [
                    { $gt: [{ $size: '$product' }, 0] },
                    // 🔧 FIX: Sử dụng purchase_price thay vì price * 0.7
                    { 
                      $multiply: [
                        '$quantity', 
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
                        // Variant: Cần lookup thêm Pet để lấy price
                        { $multiply: ['$quantity', { $arrayElemAt: ['$pet.price', 0] }] },
                        // Fallback case - có thể cần điều chỉnh
                        { $multiply: ['$quantity', { $multiply: ['$unit_price', 0.7] }] }
                      ]
                    }
                  ]
                }
              ]
            },
            itemRevenue: { $multiply: ['$quantity', '$unit_price'] }
          }
        },
        {
          $group: {
            _id: {
              itemId: {
                $cond: [
                  { $gt: [{ $size: '$pet' }, 0] }, '$pet_id',
                  {
                    $cond: [
                      { $gt: [{ $size: '$product' }, 0] }, '$product_id',
                      '$variant_id'
                    ]
                  }
                ]
              },
              itemType: '$itemType'
            },
            itemInfo: { $first: '$itemInfo' },
            totalRevenue: { $sum: '$itemRevenue' },
            totalCostPrice: { $sum: '$itemCostPrice' },
            totalQuantitySold: { $sum: '$quantity' },
            totalOrders: { $addToSet: '$order_id' }
          }
        },
        {
          $project: {
            itemInfo: 1,
            itemType: '$_id.itemType',
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
            totalQuantitySold: 1,
            totalOrders: { $size: '$totalOrders' }
          }
        },
        { $sort: { totalProfit: -1 } },
        { $limit: parseInt(limit) }
      ]);

      console.log(`✅ Found ${profitByProducts.length} products with profit data`);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Profit by products retrieved successfully',
        data: profitByProducts
      });

    } catch (error) {
      console.error('❌ Profit by products error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getCurrentInventoryValue(req, res) {
    try {
      console.log('🏪 Getting current inventory value...');

      // Tính tổng giá trị vốn của pets hiện có
      const petInventory = await Pet.aggregate([
        { $match: { status: 'available' } },
        {
          $group: {
            _id: null,
            totalPets: { $sum: 1 },
            totalValue: { $sum: '$price' } // Pet.price = cost price (giá nhập)
          }
        }
      ]);

      // 🔧 FIX: Tính tổng giá trị vốn của variants - lookup Pet để lấy price
      const variantInventory = await PetVariant.aggregate([
        { 
          $match: { 
            is_available: true, 
            stock_quantity: { $gt: 0 }
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
          $group: {
            _id: null,
            totalVariants: { $sum: '$stock_quantity' },
            // 🔧 FIX: Dùng pet.price + price_adjustment cho variant
            totalValue: { 
              $sum: { 
                $multiply: [
                  '$stock_quantity', 
                  { $add: ['$pet.price', { $ifNull: ['$price_adjustment', 0] }] }
                ] 
              } 
            }
          }
        }
      ]);

      // 🔧 FIX: Tính tổng giá trị vốn của products với purchase_price
      const productInventory = await Product.aggregate([
        { 
          $match: { 
            status: 'active', 
            stock: { $gt: 0 }
          } 
        },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: '$stock' },
            // 🔧 FIX: Sử dụng purchase_price thay vì price * 0.7
            totalValue: { 
              $sum: { 
                $multiply: [
                  '$stock', 
                  {
                    $ifNull: ['$purchase_price', { $multiply: ['$price', 0.7] }] // Fallback nếu không có purchase_price
                  }
                ] 
              } 
            }
          }
        }
      ]);

      // Debug logging để kiểm tra
      console.log('🐕 Pet inventory:', petInventory);
      console.log('🎭 Variant inventory:', variantInventory);  
      console.log('📦 Product inventory:', productInventory);

      const result = {
        pets: petInventory[0] || { totalPets: 0, totalValue: 0 },
        variants: variantInventory[0] || { totalVariants: 0, totalValue: 0 },
        products: productInventory[0] || { totalProducts: 0, totalValue: 0 }
      };

      // Tính tổng cộng
      result.summary = {
        totalItems: result.pets.totalPets + result.variants.totalVariants + result.products.totalProducts,
        totalInventoryValue: result.pets.totalValue + result.variants.totalValue + result.products.totalValue
      };

      console.log('✅ Inventory value calculated:', {
        pets: result.pets.totalPets,
        variants: result.variants.totalVariants,
        products: result.products.totalProducts,
        totalValue: result.summary.totalInventoryValue
      });

      // Debug: Log sample products để kiểm tra purchase_price field
      const sampleProducts = await Product.find({ status: 'active' })
        .limit(3)
        .select('name stock purchase_price price');
      console.log('📋 Sample products:', sampleProducts);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Current inventory value retrieved successfully',
        data: result
      });

    } catch (error) {
      console.error('❌ Current inventory value error:', error);
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

}

module.exports = new StatisticsController();