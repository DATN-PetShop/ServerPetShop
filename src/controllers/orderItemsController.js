// src/controllers/orderItemsController.js - CẬP NHẬT HỖ TRỢ VARIANT
const OrderItem = require('../models/OrderItem');
const Order = require('../models/Order');
const Pet = require('../models/Pet');
const Product = require('../models/Product');
const PetVariant = require('../models/PetVariant');
const ProductImage = require('../models/ProductImage');
const Image = require('../models/ImagePet');

const createOrderItem = async (req, res) => {
  try {
    const { quantity, unit_price, pet_id, product_id, variant_id, order_id, addresses_id } = req.body;

    console.log('🆕 Creating OrderItem with data:', req.body);

    // Kiểm tra các trường bắt buộc
    if (!quantity || !unit_price || !order_id || !addresses_id) {
      return res.status(400).json({ 
        message: 'Missing required fields: quantity, unit_price, order_id, or addresses_id' 
      });
    }

    // 🔧 CẬP NHẬT VALIDATION cho variant_id
    const itemIds = [pet_id, product_id, variant_id].filter(Boolean);
    
    if (itemIds.length === 0) {
      return res.status(400).json({ 
        message: 'At least one of pet_id, product_id, or variant_id must be provided' 
      });
    }
    
    if (itemIds.length > 1) {
      return res.status(400).json({ 
        message: 'Only one of pet_id, product_id, or variant_id can be provided' 
      });
    }

    // 🆕 VERIFY item tồn tại
    if (variant_id) {
      const variant = await PetVariant.findById(variant_id);
      if (!variant) {
        return res.status(404).json({ message: 'Variant not found' });
      }
      console.log('✅ Variant verified:', variant._id);
    } else if (pet_id) {
      const pet = await Pet.findById(pet_id);
      if (!pet) {
        return res.status(404).json({ message: 'Pet not found' });
      }
      console.log('✅ Pet verified:', pet._id);
    } else if (product_id) {
      const product = await Product.findById(product_id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      console.log('✅ Product verified:', product._id);
    }

    // 🔧 Tạo OrderItem với variant support
    const orderItemData = {
      quantity: parseInt(quantity),
      unit_price: parseFloat(unit_price),
      order_id,
      addresses_id
    };

    // Chỉ thêm ID nào có value
    if (variant_id) orderItemData.variant_id = variant_id;
    if (pet_id) orderItemData.pet_id = pet_id;
    if (product_id) orderItemData.product_id = product_id;

    console.log('Final orderItemData:', orderItemData);

    const orderItem = new OrderItem(orderItemData);
    const savedOrderItem = await orderItem.save();
    
    console.log('✅ OrderItem created successfully:', savedOrderItem._id);
    
    res.status(201).json({ 
      message: 'Order item created', 
      data: savedOrderItem 
    });
    
  } catch (error) {
    console.error('❌ Create order item error:', error.message);
    res.status(500).json({ 
      message: error.message || 'Internal server error' 
    });
  }
};

// 🆕 CẬP NHẬT getMyOrderItems để populate variant
const getMyOrderItems = async (req, res) => {
  try {
    // Bước 1: Tìm tất cả Order của người dùng
    const orders = await Order.find({ user_id: req.user.userId }).select('_id').lean();
    const orderIds = orders.map(order => order._id);

    // Bước 2: Tìm OrderItems với variant support
    const orderItems = await OrderItem.find({ order_id: { $in: orderIds } })
      .populate('pet_id', 'name price')
      .populate('product_id', 'name price')
      .populate({
        path: 'variant_id',
        populate: {
          path: 'pet_id',
          select: 'name price'
        }
      })
      .populate('addresses_id', 'name phone ward district province')
      .populate('order_id', 'total_amount status payment_method created_at')
      .lean();

    // Bước 3: Populate images cho mỗi item
    const orderItemsWithImages = await Promise.all(
      orderItems.map(async (item) => {
        let images = [];
        
        if (item.variant_id) {
          // Variant item - lấy images từ pet của variant
          if (item.variant_id.pet_id) {
            images = await Image.find({ pet_id: item.variant_id.pet_id._id }).lean();
          }
        } else if (item.pet_id) {
          // Direct pet item
          images = await Image.find({ pet_id: item.pet_id._id }).lean();
        } else if (item.product_id) {
          // Product item
          images = await ProductImage.find({ product_id: item.product_id._id }).lean();
        }

        return {
          ...item,
          images,
          item_type: item.variant_id ? 'variant' : (item.pet_id ? 'pet' : 'product')
        };
      })
    );

    res.status(200).json({ 
      data: orderItemsWithImages,
      message: `Found ${orderItemsWithImages.length} order items`
    });
    
  } catch (error) {
    console.error('❌ Fetch order items error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// 🆕 CẬP NHẬT getOrderItemsByOrderId với variant support
const getOrderItemsByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log('🔍 Fetching order items for order:', orderId);

    const orderItems = await OrderItem.find({ order_id: orderId })
      .populate('pet_id', 'name price type breed_id')
      .populate('product_id', 'name price description')
      .populate({
        path: 'variant_id',
        populate: {
          path: 'pet_id',
          select: 'name price type'
        }
      })
      .populate('addresses_id', 'name phone ward district province')
      .lean();

    if (!orderItems || orderItems.length === 0) {
      return res.status(404).json({ 
        message: 'No order items found for this order',
        data: [] 
      });
    }

    // Populate images
    const orderItemsWithImages = await Promise.all(
      orderItems.map(async (item) => {
        let images = [];
        let itemInfo = null;
        let itemType = 'unknown';

        if (item.variant_id) {
          itemType = 'variant';
          itemInfo = {
            ...item.variant_id.pet_id,
            variant: {
              _id: item.variant_id._id,
              color: item.variant_id.color,
              weight: item.variant_id.weight,
              gender: item.variant_id.gender,
              age: item.variant_id.age
            }
          };
          if (item.variant_id.pet_id) {
            images = await Image.find({ pet_id: item.variant_id.pet_id._id }).lean();
          }
        } else if (item.pet_id) {
          itemType = 'pet';
          itemInfo = item.pet_id;
          images = await Image.find({ pet_id: item.pet_id._id }).lean();
        } else if (item.product_id) {
          itemType = 'product';
          itemInfo = item.product_id;
          images = await ProductImage.find({ product_id: item.product_id._id }).lean();
        }

        return {
          ...item,
          item_type: itemType,
          item_info: itemInfo,
          images
        };
      })
    );

    console.log(`✅ Found ${orderItemsWithImages.length} order items`);
    
    res.status(200).json({ 
      data: orderItemsWithImages,
      message: `Found ${orderItemsWithImages.length} order items for order ${orderId}`
    });
    
  } catch (error) {
    console.error('❌ Fetch order items by order ID error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getOrderItemById = async (req, res) => {
  try {
    const orderItem = await OrderItem.findById(req.params.id)
      .populate('pet_id', 'name price')
      .populate('product_id', 'name price')
      .populate({
        path: 'variant_id',
        populate: {
          path: 'pet_id',
          select: 'name price'
        }
      })
      .populate('addresses_id')
      .populate('order_id');

    if (!orderItem) {
      return res.status(404).json({ message: 'Order item not found' });
    }

    res.status(200).json({ data: orderItem });
  } catch (error) {
    console.error('Fetch order item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateOrderItem = async (req, res) => {
  try {
    const updatedOrderItem = await OrderItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedOrderItem) {
      return res.status(404).json({ message: 'Order item not found' });
    }

    res.status(200).json({ 
      message: 'Order item updated', 
      data: updatedOrderItem 
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteOrderItem = async (req, res) => {
  try {
    const deletedOrderItem = await OrderItem.findByIdAndDelete(req.params.id);

    if (!deletedOrderItem) {
      return res.status(404).json({ message: 'Order item not found' });
    }

    res.status(200).json({ message: 'Order item deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  createOrderItem,
  getMyOrderItems,
  getOrderItemById,
  getOrderItemsByOrderId,
  updateOrderItem,
  deleteOrderItem,
};