// src/controllers/cartController.js
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Pet = require('../models/Pet');
const Product = require('../models/Product');
const Image = require('../models/ImagePet');
const ProductImage = require('../models/ProductImage');

class CartController {
  async addToCart(req, res) {
    try {
      const { pet_id, product_id, quantity = 1 } = req.body;
      const user_id = req.user.userId;


      // Validation cơ bản
      if (!pet_id && !product_id) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Must provide either pet_id or product_id',
          data: null
        });
      }

      if (pet_id && product_id) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Cannot add both pet and product in one cart item',
          data: null
        });
      }

      if (pet_id) {
        const pet = await Pet.findById(pet_id);
        if (!pet) {
          return res.status(404).json({
            success: false,
            statusCode: 404,
            message: 'Pet not found',
            data: null
          });
        }
      }

      if (product_id) {
        const product = await Product.findById(product_id);
        if (!product) {
          return res.status(404).json({
            success: false,
            statusCode: 404,
            message: 'Product not found',
            data: null
          });
        }
      }

      let existingCartItem = null;
      
      if (pet_id) {
        existingCartItem = await Cart.findOne({
          user_id: new mongoose.Types.ObjectId(user_id),
          pet_id: new mongoose.Types.ObjectId(pet_id),
          product_id: { $in: [null, undefined] }
        });
      } else if (product_id) {
        existingCartItem = await Cart.findOne({
          user_id: new mongoose.Types.ObjectId(user_id),
          product_id: new mongoose.Types.ObjectId(product_id),
          pet_id: { $in: [null, undefined] }
        });
      }
      
      if (existingCartItem) {
        
        existingCartItem.quantity += parseInt(quantity);
        const updatedItem = await existingCartItem.save();
        
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: 'Cart updated successfully',
          data: updatedItem
        });
      }

      
      const cartItemData = {
        user_id: new mongoose.Types.ObjectId(user_id),
        quantity: parseInt(quantity)
      };

      if (pet_id) {
        cartItemData.pet_id = new mongoose.Types.ObjectId(pet_id);
      } else if (product_id) {
        cartItemData.product_id = new mongoose.Types.ObjectId(product_id);
      }

      const newCartItem = new Cart(cartItemData);
      const savedCartItem = await newCartItem.save();
      

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Item added to cart successfully',
        data: savedCartItem
      });

    } catch (error) {
      
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          statusCode: 409,
          message: 'Item already exists in cart. Please refresh and try again.',
          data: null
        });
      }

      if (error.message.includes('must have either')) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: error.message,
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

  // Lấy giỏ hàng của user
  async getCart(req, res) {
    try {
      const user_id = req.user.userId;

      const cartItems = await Cart.find({ user_id })
        .populate('pet_id', 'name price type age weight gender status')
        .populate('product_id', 'name price description')
        .sort({ added_at: -1 })
        .lean();

      // Populate images
      for (let item of cartItems) {
        if (item.pet_id) {
          const petImages = await Image.find({ pet_id: item.pet_id._id }).lean();
          item.pet_id.images = petImages;
        }
        if (item.product_id) {
          const productImages = await ProductImage.find({ product_id: item.product_id._id }).lean();
          item.product_id.images = productImages;
        }
      }

      // Tính tổng
      let totalAmount = 0;
      let totalQuantity = 0;
      
      cartItems.forEach(item => {
        const price = item.pet_id ? item.pet_id.price : item.product_id.price;
        totalAmount += price * item.quantity;
        totalQuantity += item.quantity;
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Cart retrieved successfully',
        data: {
          items: cartItems,
          totalItems: cartItems.length,
          totalQuantity: totalQuantity,
          totalAmount: totalAmount
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Cập nhật số lượng
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

      const cartItem = await Cart.findOneAndUpdate(
        { _id: id, user_id },
        { quantity: parseInt(quantity) },
        { new: true }
      ).populate('pet_id', 'name price')
        .populate('product_id', 'name price');

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
        message: 'Cart item updated successfully',
        data: cartItem
      });

    } catch (error) {
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