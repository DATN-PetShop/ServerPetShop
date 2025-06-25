const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'e-commerce', // Thư mục trên Cloudinary
    allowedFormats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
    transformation: [{ 
      width: 800, 
      height: 800, 
      crop: 'limit', 
      quality: 'auto:good',
      format: 'auto' 
    }],
    // Tạo public_id unique
    public_id: (req, file) => {
      const timestamp = Date.now();
      const originalName = file.originalname.split('.')[0];
      return `${originalName}_${timestamp}`;
    }
  }
});

module.exports = { cloudinary, storage };