// src/controllers/favouriteController.js - ENHANCED ERROR HANDLING
const Favourite = require('../models/Favourite');

class FavouriteController {
  // ✅ ENHANCED ADD METHOD - Better duplicate handling
  async add(req, res) {
    try {
      const user_id = req.user.userId;
      const { product_id, pet_id } = req.body;

      // Validation
      if (!product_id && !pet_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cần cung cấp product_id hoặc pet_id' 
        });
      }

      if (product_id && pet_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Chỉ có thể thêm một loại (product hoặc pet)' 
        });
      }

      // ✅ CHECK DUPLICATE TRƯỚC KHI SAVE
      const filter = { user_id };
      if (product_id) filter.product_id = product_id;
      if (pet_id) filter.pet_id = pet_id;
      
      const existingFavourite = await Favourite.findOne(filter);
      if (existingFavourite) {
        console.log('📝 Duplicate favourite detected, returning existing');
        
        // ✅ RETURN SUCCESS WITH EXISTING DATA thay vì error
        return res.status(200).json({ 
          success: true, 
          message: 'Đã có trong danh sách yêu thích',
          data: existingFavourite,
          isExisting: true // ✅ Flag để frontend biết đây là existing item
        });
      }

      // Tạo favourite object mới
      const favouriteData = { user_id };
      if (product_id) favouriteData.product_id = product_id;
      if (pet_id) favouriteData.pet_id = pet_id;

      const favourite = new Favourite(favouriteData);
      await favourite.save();

      res.status(201).json({ 
        success: true, 
        message: 'Đã thêm vào yêu thích',
        data: favourite,
        isExisting: false
      });
    } catch (err) {
      // ✅ BACKUP: Handle MongoDB duplicate key error
      if (err.code === 11000) {
        console.log('📝 MongoDB duplicate key error, treating as success');
        
        // Tìm existing record để return
        const filter = { user_id: req.user.userId };
        if (req.body.product_id) filter.product_id = req.body.product_id;
        if (req.body.pet_id) filter.pet_id = req.body.pet_id;
        
        try {
          const existingFavourite = await Favourite.findOne(filter);
          return res.status(200).json({ 
            success: true, 
            message: 'Đã có trong danh sách yêu thích',
            data: existingFavourite,
            isExisting: true
          });
        } catch (findErr) {
          console.error('Error finding existing favourite:', findErr);
        }
        
        return res.status(200).json({ 
          success: true, 
          message: 'Đã có trong danh sách yêu thích',
          isExisting: true
        });
      }
      
      console.error('Add favourite error:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Lỗi server', 
        error: err.message 
      });
    }
  }

  // ✅ ENHANCED REMOVE METHOD
  async remove(req, res) {
    try {
      const user_id = req.user.userId;
      const { product_id, pet_id } = req.body;

      // Tạo query filter
      const filter = { user_id };
      if (product_id) filter.product_id = product_id;
      if (pet_id) filter.pet_id = pet_id;

      const deleted = await Favourite.findOneAndDelete(filter);
      if (!deleted) {
        // ✅ RETURN SUCCESS thay vì 404 - item đã được remove rồi
        console.log('📝 Item not in favourites, treating as success');
        return res.status(200).json({ 
          success: true, 
          message: 'Đã xóa khỏi yêu thích',
          wasExisting: false
        });
      }

      res.status(200).json({ 
        success: true, 
        message: 'Đã xóa khỏi yêu thích',
        wasExisting: true
      });
    } catch (err) {
      console.error('Remove favourite error:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Lỗi server', 
        error: err.message 
      });
    }
  }

  // ✅ GETALL METHOD - Unchanged
  async getAll(req, res) {
    try {
      const user_id = req.user.userId;
      console.log('🔍 Getting favourites for user:', user_id);
      
      const favourites = await Favourite.find({ user_id })
        .populate({
          path: 'product_id',
          select: 'name price description',
        })
        .populate({
          path: 'pet_id', 
          select: 'name price description breed_id age gender weight',
          populate: {
            path: 'breed_id',
            select: 'name'
          }
        })
        .sort({ created_at: -1 })
        .lean();

      // ✅ MANUALLY ADD IMAGES
      for (let favourite of favourites) {
        if (favourite.product_id) {
          const ProductImage = require('../models/ProductImage');
          favourite.product_id.images = await ProductImage.find({ 
            product_id: favourite.product_id._id 
          }).select('url is_primary').lean();
        }
        
        if (favourite.pet_id) {
          const ImagePet = require('../models/ImagePet');
          favourite.pet_id.images = await ImagePet.find({ 
            pet_id: favourite.pet_id._id 
          }).select('url is_primary').lean();
        }
      }

      res.status(200).json({ 
        success: true, 
        data: favourites,
        message: 'Favourites retrieved successfully',
        statusCode: 200
      });
    } catch (err) {
      console.error('Get favourites error:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Lỗi server', 
        error: err.message 
      });
    }
  }

  // ✅ CHECK FAVOURITE METHOD - Enhanced
  async checkFavourite(req, res) {
    try {
      const user_id = req.user.userId;
      const { product_id, pet_id } = req.query;

      if (!product_id && !pet_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cần cung cấp product_id hoặc pet_id' 
        });
      }

      const filter = { user_id };
      if (product_id) filter.product_id = product_id;
      if (pet_id) filter.pet_id = pet_id;

      const favourite = await Favourite.findOne(filter);

      res.status(200).json({ 
        success: true, 
        data: { 
          isFavorite: !!favourite,
          favourite: favourite || null
        },
        message: 'Favourite status checked successfully'
      });
    } catch (err) {
      console.error('Check favourite error:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Lỗi server', 
        error: err.message 
      });
    }
  }
}

const controller = new FavouriteController();
module.exports = {
  addFavourite: controller.add.bind(controller),
  removeFavourite: controller.remove.bind(controller),
  getFavourites: controller.getAll.bind(controller),
  checkFavourite: controller.checkFavourite.bind(controller),
};