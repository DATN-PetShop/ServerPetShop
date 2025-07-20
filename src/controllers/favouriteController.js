// src/controllers/favouriteController.js - FIXED - Giữ nguyên routes cũ
const Favourite = require('../models/Favourite');

class FavouriteController {
  // ✅ Thêm yêu thích (hỗ trợ cả product và pet) - FIXED DUPLICATE
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
        return res.status(400).json({ 
          success: false, 
          message: 'Đã có trong danh sách yêu thích' 
        });
      }

      // Tạo favourite object
      const favouriteData = { user_id };
      if (product_id) favouriteData.product_id = product_id;
      if (pet_id) favouriteData.pet_id = pet_id;

      const favourite = new Favourite(favouriteData);
      await favourite.save();

      res.status(201).json({ 
        success: true, 
        message: 'Đã thêm vào yêu thích',
        data: favourite
      });
    } catch (err) {
      // ✅ Handle MongoDB duplicate key error (backup protection)
      if (err.code === 11000) {
        return res.status(400).json({ 
          success: false, 
          message: 'Đã có trong danh sách yêu thích' 
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

  // Xóa yêu thích - GIỮ NGUYÊN
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
        return res.status(404).json({ 
          success: false, 
          message: 'Không tìm thấy trong danh sách yêu thích' 
        });
      }

      res.status(200).json({ 
        success: true, 
        message: 'Đã xóa khỏi yêu thích' 
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

  // Lấy danh sách yêu thích - GIỮ NGUYÊN
  async getAll(req, res) {
    try {
      const user_id = req.user.userId;
      console.log('🔍 Getting favourites for user:', user_id);
      
      const favourites = await Favourite.find({ user_id })
        .populate({
          path: 'product_id',
          select: 'name price description',
          // ✅ KHÔNG POPULATE TRỰC TIẾP VÌ RELATIONSHIP PHỨC TẠP
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
        .lean(); // ✅ SỬ DỤNG LEAN() ĐỂ MODIFY DỄ DÀNG

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

  // Kiểm tra item có trong yêu thích hay không - GIỮ NGUYÊN
  async checkFavourite(req, res) {
    try {
      const user_id = req.user.userId;
      const { product_id, pet_id } = req.query;

      const filter = { user_id };
      if (product_id) filter.product_id = product_id;
      if (pet_id) filter.pet_id = pet_id;

      const favourite = await Favourite.findOne(filter);

      res.status(200).json({ 
        success: true, 
        isFavorite: !!favourite,
        data: favourite
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