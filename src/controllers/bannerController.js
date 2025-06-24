const Banner = require('../models/Banner');
const { cloudinary } = require('../config/cloudinaryConfig');

class BannerController {
  async createBanner(req, res) {
    try {
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Banner name is required',
          data: null
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Banner image is required',
          data: null
        });
      }

      const banner = new Banner({
        name,
        image: req.file.path 
      });

      const savedBanner = await banner.save();

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Banner created successfully',
        data: savedBanner
      });

    } catch (error) {
      console.error('Create banner error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getAllBanners(req, res) {
    try {
      const banners = await Banner.find()
        .sort({ created_at: -1 })
        .lean();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Banners retrieved successfully',
        data: banners
      });

    } catch (error) {
      console.error('Get all banners error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getBannerById(req, res) {
    try {
      const banner = await Banner.findById(req.params.id).lean();

      if (!banner) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Banner not found',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Banner retrieved successfully',
        data: banner
      });

    } catch (error) {
      console.error('Get banner by ID error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async updateBanner(req, res) {
    try {
      const { name } = req.body;

      const banner = await Banner.findById(req.params.id);
      
      if (!banner) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Banner not found',
          data: null
        });
      }

      if (name) {
        banner.name = name;
      }

      if (req.file) {
        if (banner.image) {
          try {
            const publicId = this.extractPublicIdFromUrl(banner.image);
            if (publicId) {
              await cloudinary.uploader.destroy(publicId);
            }
          } catch (error) {
            console.error('Error deleting old image from Cloudinary:', error);
          }
        }
        
        banner.image = req.file.path; // New Cloudinary URL
      }

      const updatedBanner = await banner.save();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Banner updated successfully',
        data: updatedBanner
      });

    } catch (error) {
      console.error('Update banner error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async deleteBanner(req, res) {
    try {
      const banner = await Banner.findById(req.params.id);
      
      if (!banner) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Banner not found',
          data: null
        });
      }

      if (banner.image) {
        try {
          const publicId = this.extractPublicIdFromUrl(banner.image);
          if (publicId) {
            await cloudinary.uploader.destroy(publicId);
          }
        } catch (error) {
          console.error('Error deleting image from Cloudinary:', error);
        }
      }

      await Banner.findByIdAndDelete(req.params.id);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Banner deleted successfully',
        data: null
      });

    } catch (error) {
      console.error('Delete banner error:', error);
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
      const parts = url.split('/');
      const uploadIndex = parts.indexOf('upload');
      if (uploadIndex !== -1 && uploadIndex + 2 < parts.length) {
        const publicIdWithExt = parts.slice(uploadIndex + 2).join('/');
        return publicIdWithExt.split('.')[0];
      }
      return null;
    } catch (error) {
      console.error('Error extracting public_id:', error);
      return null;
    }
  }
}

const bannerController = new BannerController();

module.exports = {
  createBanner: bannerController.createBanner.bind(bannerController),
  getAllBanners: bannerController.getAllBanners.bind(bannerController),
  getBannerById: bannerController.getBannerById.bind(bannerController),
  updateBanner: bannerController.updateBanner.bind(bannerController),
  deleteBanner: bannerController.deleteBanner.bind(bannerController)
};