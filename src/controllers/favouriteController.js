const Favourite = require('../models/Favourite');
const PetVariant = require('../models/PetVariant');
const ProductImage = require('../models/ProductImage');
const ImagePet = require('../models/ImagePet');

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

  // ✅ GETALL METHOD - Enhanced with Variants
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
          select: 'name description breed_id age gender weight',
          populate: {
            path: 'breed_id',
            select: 'name'
          }
        })
        .sort({ created_at: -1 })
        .lean();

      // ✅ MANUALLY ADD IMAGES AND VARIANTS
      for (let favourite of favourites) {
        if (favourite.product_id) {
          favourite.product_id.images = await ProductImage.find({ 
            product_id: favourite.product_id._id 
          }).select('url is_primary').lean();
        }
        
        if (favourite.pet_id) {
          // Thêm ảnh
          favourite.pet_id.images = await ImagePet.find({ 
            pet_id: favourite.pet_id._id 
          }).select('url is_primary').lean();

          // Thêm variants
          const variants = await PetVariant.find({ 
            pet_id: favourite.pet_id._id, 
            is_available: true 
          }).lean();

          // Tính final_price cho mỗi variant
          const variantsWithPrice = await Promise.all(
            variants.map(async (variant) => {
              const finalPrice = variant.selling_price; // Sử dụng selling_price
              return {
                ...variant,
                final_price: finalPrice,
                display_name: `${variant.color} - ${variant.weight}kg - ${variant.gender} - ${variant.age} years`
              };
            })
          );

          favourite.pet_id.variants = variantsWithPrice;

          // Tính variant_options, display_price và price_range
          if (variantsWithPrice.length > 0) {
            const colors = [...new Set(variantsWithPrice.map(v => v.color))].sort();
            const genders = [...new Set(variantsWithPrice.map(v => v.gender))].sort();
            const ages = [...new Set(variantsWithPrice.map(v => v.age))].sort((a, b) => a - b);
            const weights = [...new Set(variantsWithPrice.map(v => v.weight))].sort((a, b) => a - b);

            favourite.pet_id.variant_options = {
              colors,
              genders,
              age_range: { min: Math.min(...ages), max: Math.max(...ages) },
              weight_range: { min: Math.min(...weights), max: Math.max(...weights) }
            };

            // Tính display_price và price_range
            const prices = variantsWithPrice.map(v => v.final_price).filter(price => price !== null && price !== undefined);
            const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
            const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

            favourite.pet_id.display_price = minPrice;
            favourite.pet_id.price_range = {
              min: minPrice,
              max: maxPrice,
              hasRange: minPrice !== maxPrice
            };
          } else {
            favourite.pet_id.variants = [];
            favourite.pet_id.variant_options = {};
            favourite.pet_id.display_price = 0;
            favourite.pet_id.price_range = {
              min: 0,
              max: 0,
              hasRange: false
            };
          }
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