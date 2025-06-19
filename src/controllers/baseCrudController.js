const { cloudinary } = require('../config/cloudinaryConfig');

class BaseCrudController {
  constructor(model, imageModel = null) {
    this.model = model;
    this.imageModel = imageModel;
  }

  async create(req, res) {
    try {
      const requiredFields = this.getRequiredFields();
      const data = { ...req.body, user_id: req.user?.userId };

      for (const field of requiredFields) {
        if (!data[field]) {
          return res.status(400).json({
            success: false,
            statusCode: 400,
            message: `${field} is required`,
            data: null
          });
        }
      }

      const entity = new this.model(data);
      const savedEntity = await entity.save();

      // Xử lý ảnh từ req.files - FIXED
      if (this.imageModel && req.files && req.files.length > 0) {
        // Files đã được upload lên Cloudinary tự động qua multer-storage-cloudinary
        const imageDocs = req.files.map((file, index) => ({
          url: file.path, // Cloudinary URL
          is_primary: index === 0, // Ảnh đầu tiên là primary
          [this.getImageForeignKey()]: savedEntity._id
        }));
        
        await this.imageModel.insertMany(imageDocs);
      }

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: `${this.getEntityName()} created`,
        data: savedEntity
      });
    } catch (error) {
      console.error(`Create ${this.getEntityName()} error:`, error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async update(req, res) {
    try {
      const updated = await this.model.findOneAndUpdate(
        { _id: req.params.id, ...(req.user?.userId ? { user_id: req.user.userId } : {}) },
        req.body,
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: `${this.getEntityName()} not found`,
          data: null
        });
      }

      // Xử lý ảnh mới (nếu có) - FIXED
      if (this.imageModel && req.files && req.files.length > 0) {
        // Lấy ảnh cũ để xóa khỏi Cloudinary
        const oldImages = await this.imageModel.find({ [this.getImageForeignKey()]: updated._id });
        
        // Xóa ảnh cũ khỏi Cloudinary
        if (oldImages.length > 0) {
          const deletePromises = oldImages.map(async (img) => {
            try {
              // Extract public_id from Cloudinary URL
              const publicId = this.extractPublicIdFromUrl(img.url);
              if (publicId) {
                await cloudinary.uploader.destroy(publicId);
              }
            } catch (error) {
              console.error('Error deleting image from Cloudinary:', error);
            }
          });
          await Promise.allSettled(deletePromises);
        }

        // Xóa records ảnh cũ từ database
        await this.imageModel.deleteMany({ [this.getImageForeignKey()]: updated._id });

        // Thêm ảnh mới
        const imageDocs = req.files.map((file, index) => ({
          url: file.path, // Cloudinary URL
          is_primary: index === 0, // Ảnh đầu tiên là primary
          [this.getImageForeignKey()]: updated._id
        }));
        
        await this.imageModel.insertMany(imageDocs);
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `${this.getEntityName()} updated`,
        data: updated
      });
    } catch (error) {
      console.error(`Update ${this.getEntityName()} error:`, error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getAll(req, res) {
    try {
      const query = req.user?.userId ? { user_id: req.user.userId } : {};
      const entities = await this.model.find(query).lean();
      const entityIds = entities.map(e => e._id);
      const images = this.imageModel ? await this.imageModel.find({ [this.getImageForeignKey()]: { $in: entityIds } }) : [];

      const full = entities.map(entity => ({
        ...entity,
        images: images.filter(img => img[this.getImageForeignKey()].toString() === entity._id.toString())
      }));

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `${this.getEntityName()}s retrieved successfully`,
        data: full
      });
    } catch (error) {
      console.error(`Get all ${this.getEntityName()}s error:`, error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async delete(req, res) {
    try {
      const deleted = await this.model.findOneAndDelete({ 
        _id: req.params.id, 
        ...(req.user?.userId ? { user_id: req.user.userId } : {}) 
      });
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: `${this.getEntityName()} not found`,
          data: null
        });
      }

      // Xóa ảnh liên quan - IMPROVED
      if (this.imageModel) {
        const imagesToDelete = await this.imageModel.find({ [this.getImageForeignKey()]: deleted._id });
        
        // Xóa ảnh khỏi Cloudinary
        if (imagesToDelete.length > 0) {
          const deletePromises = imagesToDelete.map(async (img) => {
            try {
              const publicId = this.extractPublicIdFromUrl(img.url);
              if (publicId) {
                await cloudinary.uploader.destroy(publicId);
              }
            } catch (error) {
              console.error('Error deleting image from Cloudinary:', error);
            }
          });
          await Promise.allSettled(deletePromises);
        }

        await this.imageModel.deleteMany({ [this.getImageForeignKey()]: deleted._id });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `${this.getEntityName()} deleted`,
        data: null
      });
    } catch (error) {
      console.error(`Delete ${this.getEntityName()} error:`, error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }


  extractPublicIdFromUrl(url) {
    try {
      // Cloudinary URL format: https://res.cloudinary.com/cloud_name/image/upload/v123456/folder/public_id.jpg
      const parts = url.split('/');
      const uploadIndex = parts.indexOf('upload');
      if (uploadIndex !== -1 && uploadIndex + 2 < parts.length) {
        // Lấy phần sau 'upload/v123456/' và remove extension
        const publicIdWithExt = parts.slice(uploadIndex + 2).join('/');
        return publicIdWithExt.split('.')[0]; // Remove file extension
      }
      return null;
    } catch (error) {
      console.error('Error extracting public_id:', error);
      return null;
    }
  }

  // Phương thức phải được ghi đè
  getRequiredFields() { throw new Error('getRequiredFields must be implemented'); }
  getEntityName() { throw new Error('getEntityName must be implemented'); }
  getImageForeignKey() { return this.imageModel ? 'product_id' : null; } 
}

module.exports = BaseCrudController;