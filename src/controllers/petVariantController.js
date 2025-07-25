// src/controllers/petVariantController.js
const PetVariant = require('../models/PetVariant');
const Pet = require('../models/Pet');
const mongoose = require('mongoose');

class PetVariantController {
  
  // Tạo biến thể mới cho pet
  async createVariant(req, res) {
    try {
      const { pet_id, color, weight, gender, age, price_adjustment, stock_quantity } = req.body;

      // Validate required fields
      if (!pet_id || !color || !weight || !gender || age === undefined) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Missing required fields: pet_id, color, weight, gender, age',
          data: null
        });
      }

      // Kiểm tra pet có tồn tại không
      const pet = await Pet.findById(pet_id);
      if (!pet) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Pet not found',
          data: null
        });
      }

      // Kiểm tra biến thể đã tồn tại chưa
      const existingVariant = await PetVariant.findOne({
        pet_id,
        color: color.trim(),
        weight,
        gender,
        age
      });

      if (existingVariant) {
        return res.status(409).json({
          success: false,
          statusCode: 409,
          message: 'Variant with these specifications already exists',
          data: null
        });
      }

      // Tạo biến thể mới
      const variant = new PetVariant({
        pet_id,
        color: color.trim(),
        weight,
        gender,
        age,
        price_adjustment: price_adjustment || 0,
        stock_quantity: stock_quantity || 1
      });

      const savedVariant = await variant.save();
      
      // Populate pet info
      await savedVariant.populate('pet_id', 'name price type breed_id');

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Pet variant created successfully',
        data: savedVariant
      });

    } catch (error) {
      console.error('Create variant error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Lấy tất cả biến thể của một pet
  async getVariantsByPetId(req, res) {
    try {
      const { petId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(petId)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Invalid pet ID',
          data: null
        });
      }

      const variants = await PetVariant.find({ 
        pet_id: petId,
        is_available: true 
      })
      .populate('pet_id', 'name price type breed_id')
      .sort({ created_at: -1 });

      // Tính final price cho mỗi variant
      const variantsWithPrice = await Promise.all(
        variants.map(async (variant) => {
          const finalPrice = await variant.getFinalPrice();
          return {
            ...variant.toObject(),
            final_price: finalPrice,
            display_name: variant.getDisplayName()
          };
        })
      );

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Pet variants retrieved successfully',
        data: variantsWithPrice
      });

    } catch (error) {
      console.error('Get variants error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Lấy biến thể với filter
  async getVariantsWithFilter(req, res) {
    try {
      const { petId } = req.params;
      const { color, gender, minAge, maxAge, minWeight, maxWeight } = req.query;

      if (!mongoose.Types.ObjectId.isValid(petId)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Invalid pet ID',
          data: null
        });
      }

      const filters = {};
      if (color) filters.color = color;
      if (gender) filters.gender = gender;
      if (minAge) filters.minAge = Number(minAge);
      if (maxAge) filters.maxAge = Number(maxAge);
      if (minWeight) filters.minWeight = Number(minWeight);
      if (maxWeight) filters.maxWeight = Number(maxWeight);

      const variants = await PetVariant.findAvailableVariants(petId, filters)
        .populate('pet_id', 'name price type breed_id')
        .sort({ created_at: -1 });

      const variantsWithPrice = await Promise.all(
        variants.map(async (variant) => {
          const finalPrice = await variant.getFinalPrice();
          return {
            ...variant.toObject(),
            final_price: finalPrice,
            display_name: variant.getDisplayName()
          };
        })
      );

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Filtered variants retrieved successfully',
        data: variantsWithPrice
      });

    } catch (error) {
      console.error('Get filtered variants error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Lấy thông tin một biến thể cụ thể
  async getVariantById(req, res) {
    try {
      const { variantId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(variantId)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Invalid variant ID',
          data: null
        });
      }

      const variant = await PetVariant.findById(variantId)
        .populate('pet_id', 'name price type breed_id description status');

      if (!variant) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Variant not found',
          data: null
        });
      }

      const finalPrice = await variant.getFinalPrice();
      
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Variant retrieved successfully',
        data: {
          ...variant.toObject(),
          final_price: finalPrice,
          display_name: variant.getDisplayName()
        }
      });

    } catch (error) {
      console.error('Get variant by ID error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Cập nhật biến thể
  async updateVariant(req, res) {
    try {
      const { variantId } = req.params;
      const updateData = req.body;

      if (!mongoose.Types.ObjectId.isValid(variantId)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Invalid variant ID',
          data: null
        });
      }

      // Loại bỏ các field không được phép update
      delete updateData.pet_id;
      delete updateData.sku;
      delete updateData.created_at;

      const updatedVariant = await PetVariant.findByIdAndUpdate(
        variantId,
        { ...updateData, updated_at: Date.now() },
        { new: true, runValidators: true }
      ).populate('pet_id', 'name price type breed_id');

      if (!updatedVariant) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Variant not found',
          data: null
        });
      }

      const finalPrice = await updatedVariant.getFinalPrice();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Variant updated successfully',
        data: {
          ...updatedVariant.toObject(),
          final_price: finalPrice,
          display_name: updatedVariant.getDisplayName()
        }
      });

    } catch (error) {
      console.error('Update variant error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Xóa biến thể (soft delete)
  async deleteVariant(req, res) {
    try {
      const { variantId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(variantId)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Invalid variant ID',
          data: null
        });
      }

      const variant = await PetVariant.findByIdAndUpdate(
        variantId,
        { is_available: false, updated_at: Date.now() },
        { new: true }
      );

      if (!variant) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Variant not found',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Variant deleted successfully',
        data: null
      });

    } catch (error) {
      console.error('Delete variant error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  // Lấy các option có sẵn cho filter (cho frontend)
  async getVariantOptions(req, res) {
    try {
      const { petId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(petId)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Invalid pet ID',
          data: null
        });
      }

      const variants = await PetVariant.find({ 
        pet_id: petId, 
        is_available: true,
        stock_quantity: { $gt: 0 }
      });

      // Tạo danh sách options unique
      const colors = [...new Set(variants.map(v => v.color))].sort();
      const genders = [...new Set(variants.map(v => v.gender))].sort();
      const ages = [...new Set(variants.map(v => v.age))].sort((a, b) => a - b);
      const weights = [...new Set(variants.map(v => v.weight))].sort((a, b) => a - b);

      const ageRange = ages.length > 0 ? { min: Math.min(...ages), max: Math.max(...ages) } : null;
      const weightRange = weights.length > 0 ? { min: Math.min(...weights), max: Math.max(...weights) } : null;

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Variant options retrieved successfully',
        data: {
          colors,
          genders,
          ages,
          weights,
          ageRange,
          weightRange,
          totalVariants: variants.length
        }
      });

    } catch (error) {
      console.error('Get variant options error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
}

const petVariantController = new PetVariantController();

module.exports = {
  createVariant: petVariantController.createVariant.bind(petVariantController),
  getVariantsByPetId: petVariantController.getVariantsByPetId.bind(petVariantController),
  getVariantsWithFilter: petVariantController.getVariantsWithFilter.bind(petVariantController),
  getVariantById: petVariantController.getVariantById.bind(petVariantController),
  updateVariant: petVariantController.updateVariant.bind(petVariantController),
  deleteVariant: petVariantController.deleteVariant.bind(petVariantController),
  getVariantOptions: petVariantController.getVariantOptions.bind(petVariantController)
};