const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const upload = require('../middleware/upload');
const {
  createBanner,
  getAllBanners,
  getBannerById,
  updateBanner,
  deleteBanner
} = require('../controllers/BannerController');

router.get('/', getAllBanners);                 
router.get('/:id', getBannerById);                

router.post('/', 
  auth, 
  requireRoles(['Admin', 'Staff']), 
  upload.single('image'),                       
  createBanner
);

router.put('/:id', 
  auth, 
  requireRoles(['Admin', 'Staff']), 
  upload.single('image'),                        
  updateBanner
);

router.delete('/:id', 
  auth, 
  requireRoles(['Admin', 'Staff']), 
  deleteBanner
);

module.exports = router;