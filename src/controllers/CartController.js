// src/controllers/cartController.js - CẬP NHẬT CHO PRICE STRUCTURE MỚI
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Pet = require('../models/Pet');
const Product = require('../models/Product');
const PetVariant = require('../models/PetVariant');
const Image = require('../models/ImagePet');
const ProductImage = require('../models/ProductImage');

class CartController {
  async addToCart(req, res) {
    try {
      const { pet_id, product_id, variant_id, quantity = 1 } = req.body;
      const user_id = req.user.userId;

      console.log('🛒 Add to cart request:', { user_id, pet_id, product_id, variant_id, quantity });

      // Validation
      const itemTypes = [pet_id, product_id, variant_id].filter(Boolean);
      if (itemTypes.length === 0) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Must provide either pet_id, product_id, or variant_id',
          data: null
        });
      }

      if (itemTypes.length > 1) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Can only add one type of item at a time',
          data: null
        });
      }

      if (quantity <= 0) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Quantity must be greater than 0',
          data: null
        });
      }

      // 🔧 UPDATED: Kiểm tra item tồn tại và available
      let itemData = null;
      let itemPrice = 0;

      if (variant_id) {
        console.log('🧬 Adding variant to cart:', variant_id);
        
        // Add pet variant to cart
        const variant = await PetVariant.findById(variant_id)
          .populate('pet_id', 'name status type description');
        
        if (!variant) {
          return res.status(404).json({
            success: false,
            statusCode: 404,
            message: 'Variant not found',
            data: null
          });
        }

        if (!variant.is_available || variant.stock_quantity < quantity) {
          return res.status(400).json({
            success: false,
            statusCode: 400,
            message: 'Variant not available or insufficient stock',
            data: null
          });
        }

        if (variant.pet_id.status !== 'available') {
          return res.status(400).json({
            success: false,
            statusCode: 400,
            message: 'Pet is not available for purchase',
            data: null
          });
        }

        itemData = variant;
        // 🔧 FIXED: Sử dụng selling_price thay vì price + price_adjustment
        itemPrice = variant.selling_price || variant.import_price || 0;

      } else if (pet_id) {
        console.log('🐕 Adding pet to cart:', pet_id);
        
        // 🔧 UPDATED: Pet không có price field - cần kiểm tra variants
        const pet = await Pet.findById(pet_id);
        if (!pet || pet.status !== 'available') {
          return res.status(404).json({
            success: false,
            statusCode: 404,
            message: 'Pet not found or not available',
            data: null
          });
        }

        // 🔧 FIXED: Kiểm tra xem pet có variants không
        const availableVariants = await PetVariant.find({
          pet_id: pet._id,
          is_available: true,
          stock_quantity: { $gt: 0 }
        });

        if (availableVariants.length === 0) {
          return res.status(400).json({
            success: false,
            statusCode: 400,
            message: 'Pet has no available variants. Please select a specific variant.',
            data: null
          });
        }

        // 🔧 FIXED: Lấy giá rẻ nhất từ variants
        itemData = pet;
        itemPrice = Math.min(...availableVariants.map(v => v.selling_price || v.import_price || 0));

      } else if (product_id) {
        console.log('📦 Adding product to cart:', product_id);
        
        // Add product to cart
        const product = await Product.findById(product_id);
        if (!product) {
          return res.status(404).json({
            success: false,
            statusCode: 404,
            message: 'Product not found',
            data: null
          });
        }
        
        itemData = product;
        itemPrice = product.price || 0; // Product vẫn có price field
      }

      // Check existing cart item
      let existingCartItem = null;
      
      if (variant_id) {
        existingCartItem = await Cart.findOne({
          user_id: new mongoose.Types.ObjectId(user_id),
          variant_id: new mongoose.Types.ObjectId(variant_id),
          pet_id: { $in: [null, undefined] },
          product_id: { $in: [null, undefined] }
        });
      } else if (pet_id) {
        existingCartItem = await Cart.findOne({
          user_id: new mongoose.Types.ObjectId(user_id),
          pet_id: new mongoose.Types.ObjectId(pet_id),
          variant_id: { $in: [null, undefined] },
          product_id: { $in: [null, undefined] }
        });
      } else if (product_id) {
        existingCartItem = await Cart.findOne({
          user_id: new mongoose.Types.ObjectId(user_id),
          product_id: new mongoose.Types.ObjectId(product_id),
          pet_id: { $in: [null, undefined] },
          variant_id: { $in: [null, undefined] }
        });
      }
      
      if (existingCartItem) {
        const newQuantity = existingCartItem.quantity + parseInt(quantity);
        
        // Kiểm tra stock nếu là variant
        if (variant_id && newQuantity > itemData.stock_quantity) {
          return res.status(400).json({
            success: false,
            statusCode: 400,
            message: `Only ${itemData.stock_quantity} items available in stock`,
            data: null
          });
        }
        
        existingCartItem.quantity = newQuantity;
        const updatedItem = await existingCartItem.save();
        
        console.log('✅ Updated existing cart item:', updatedItem._id);
        
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: 'Cart updated successfully',
          data: updatedItem
        });
      }

      // Tạo cart item mới
      const cartItemData = {
        user_id: new mongoose.Types.ObjectId(user_id),
        quantity: parseInt(quantity)
      };

      if (variant_id) {
        cartItemData.variant_id = new mongoose.Types.ObjectId(variant_id);
      } else if (pet_id) {
        cartItemData.pet_id = new mongoose.Types.ObjectId(pet_id);
      } else if (product_id) {
        cartItemData.product_id = new mongoose.Types.ObjectId(product_id);
      }

      const newCartItem = new Cart(cartItemData);
      const savedCartItem = await newCartItem.save();
      
      console.log('✅ Added new item to cart:', savedCartItem._id);

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Item added to cart successfully',
        data: savedCartItem
      });

    } catch (error) {
      console.error('❌ Add to cart error:', error);
      
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          statusCode: 409,
          message: 'Item already exists in cart. Please refresh and try again.',
          data: null
        });
      }

      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // 🔧 UPDATED: getCart method cho price structure mới
  async getCart(req, res) {
    try {
      const user_id = req.user.userId;
      console.log('🛒 Fetching cart for user:', user_id);

      const cartItems = await Cart.find({ user_id })
        .populate('pet_id', 'name type description status') // 🔧 REMOVED price
        .populate('product_id', 'name price description')
        .populate({
          path: 'variant_id',
          populate: {
            path: 'pet_id',
            select: 'name status type description' // 🔧 REMOVED price
          }
        })
        .sort({ added_at: -1 })
        .lean();

      console.log(`📦 Found ${cartItems.length} items in cart`);

      // 🔧 UPDATED: Populate images và tính final price với structure mới
      const itemsWithDetails = await Promise.all(
        cartItems.map(async (item) => {
          let finalPrice = 0;
          let itemInfo = null;
          let itemType = 'unknown';

          if (item.variant_id) {
            console.log('🧬 Processing variant item:', item.variant_id._id);
            
            // Pet variant item
            const variant = item.variant_id;
            // 🔧 FIXED: Sử dụng selling_price thay vì price + price_adjustment
            finalPrice = variant.selling_price || variant.import_price || 0;
            itemType = 'variant';
            
            // Get pet images
            const petImages = await Image.find({ pet_id: variant.pet_id._id }).lean();
            
            itemInfo = {
              ...variant.pet_id,
              variant: {
                _id: variant._id,
                color: variant.color,
                weight: variant.weight,
                gender: variant.gender,
                age: variant.age,
                selling_price: variant.selling_price,
                import_price: variant.import_price,
                stock_quantity: variant.stock_quantity,
                sku: variant.sku,
                display_name: `${variant.color} - ${variant.weight}kg - ${variant.gender} - ${variant.age} tuổi`
              },
              images: petImages
            };

          } else if (item.pet_id) {
            console.log('🐕 Processing pet item:', item.pet_id._id);
            
            // 🔧 UPDATED: Pet không có price - tìm giá từ variants
            const availableVariants = await PetVariant.find({
              pet_id: item.pet_id._id,
              is_available: true,
              stock_quantity: { $gt: 0 }
            });

            if (availableVariants.length > 0) {
              // Lấy giá rẻ nhất từ variants
              finalPrice = Math.min(...availableVariants.map(v => v.selling_price || v.import_price || 0));
            } else {
              // Pet không có variants available
              finalPrice = 0;
            }

            itemType = 'pet';
            const petImages = await Image.find({ pet_id: item.pet_id._id }).lean();
            itemInfo = { 
              ...item.pet_id, 
              images: petImages,
              hasVariants: availableVariants.length > 0
            };

          } else if (item.product_id) {
            console.log('📦 Processing product item:', item.product_id._id);
            
            // Product item
            finalPrice = item.product_id.price || 0;
            itemType = 'product';
            const productImages = await ProductImage.find({ product_id: item.product_id._id }).lean();
            itemInfo = { ...item.product_id, images: productImages };
          }

          console.log(`💰 Calculated price for ${itemType}:`, finalPrice);

          return {
            _id: item._id,
            quantity: item.quantity,
            added_at: item.added_at,
            item_type: itemType,
            item_info: itemInfo,
            unit_price: finalPrice, // 🔧 ĐÂY LÀ GIÁ SẼ HIỂN THỊ TRÊN FRONTEND
            total_price: finalPrice * item.quantity,
            // Thêm thông tin variant nếu có
            variant_id: item.variant_id || null
          };
        })
      );

      // Tính tổng
      const totalAmount = itemsWithDetails.reduce((sum, item) => sum + item.total_price, 0);
      const totalQuantity = itemsWithDetails.reduce((sum, item) => sum + item.quantity, 0);

      console.log(`💰 Cart totals: Amount=${totalAmount}, Quantity=${totalQuantity}`);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Cart retrieved successfully',
        data: {
          items: itemsWithDetails,
          totalItems: itemsWithDetails.length,
          totalQuantity: totalQuantity,
          totalAmount: totalAmount,
          summary: {
            total_items: totalQuantity,
            total_amount: totalAmount,
            item_count: itemsWithDetails.length
          }
        }
      });

    } catch (error) {
      console.error('❌ Get cart error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // 🔧 UPDATED: updateCartItem với stock check cho variants
  async updateCartItem(req, res) {
    try {
      const { id } = req.params;
      const { quantity } = req.body;
      const user_id = req.user.userId;

      if (!quantity || quantity < 1) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Quantity must be at least 1',
          data: null
        });
      }

      // Kiểm tra stock limit nếu là variant
      const cartItem = await Cart.findOne({ _id: id, user_id })
        .populate('variant_id');

      if (!cartItem) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Cart item not found',
          data: null
        });
      }

      // Kiểm tra stock nếu là variant
      if (cartItem.variant_id && quantity > cartItem.variant_id.stock_quantity) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: `Only ${cartItem.variant_id.stock_quantity} items available in stock`,
          data: null
        });
      }

      const updatedCartItem = await Cart.findOneAndUpdate(
        { _id: id, user_id },
        { quantity: parseInt(quantity) },
        { new: true }
      ).populate('pet_id', 'name type status') // 🔧 REMOVED price
        .populate('product_id', 'name price description')
        .populate({
          path: 'variant_id',
          populate: {
            path: 'pet_id',
            select: 'name type status' // 🔧 REMOVED price
          }
        });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Cart item updated successfully',
        data: updatedCartItem
      });

    } catch (error) {
      console.error('❌ Update cart item error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Xóa item khỏi giỏ hàng
  async removeFromCart(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.userId;

      const cartItem = await Cart.findOneAndDelete({ _id: id, user_id });

      if (!cartItem) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Cart item not found',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Item removed from cart successfully',
        data: null
      });

    } catch (error) {
      console.error('❌ Remove from cart error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Xóa toàn bộ giỏ hàng
  async clearCart(req, res) {
    try {
      const user_id = req.user.userId;
      const result = await Cart.deleteMany({ user_id });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Cart cleared successfully. Removed ${result.deletedCount} items.`,
        data: { deletedCount: result.deletedCount }
      });

    } catch (error) {
      console.error('❌ Clear cart error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Lấy số lượng items
  async getCartCount(req, res) {
    try {
      const user_id = req.user.userId;
      
      const totalItems = await Cart.countDocuments({ user_id });
      
      // Nếu muốn tính tổng quantity
      const result = await Cart.aggregate([
        { $match: { user_id: new mongoose.Types.ObjectId(user_id) } },
        { $group: { _id: null, totalQuantity: { $sum: '$quantity' }, totalItems: { $sum: 1 } } }
      ]);

      const count = result.length > 0 ? result[0] : { totalQuantity: 0, totalItems: 0 };

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Cart count retrieved successfully',
        data: { 
          count: count.totalItems,
          totalQuantity: count.totalQuantity 
        }
      });

    } catch (error) {
      console.error('❌ Get cart count error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
}

const cartController = new CartController();

module.exports = {
  addToCart: cartController.addToCart.bind(cartController),
  getCart: cartController.getCart.bind(cartController),
  updateCartItem: cartController.updateCartItem.bind(cartController),
  removeFromCart: cartController.removeFromCart.bind(cartController),
  clearCart: cartController.clearCart.bind(cartController),
  getCartCount: cartController.getCartCount.bind(cartController)
};