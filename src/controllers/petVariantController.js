// src/controllers/petVariantController.js
const PetVariant = require('../models/PetVariant');
const Pet = require('../models/Pet');
const mongoose = require('mongoose');

class PetVariantController {
  
  // Tạo biến thể mới cho pet
  async createVariant(req, res) {
    try {
      const { pet_id, color, weight, gender, age, import_price, selling_price, stock_quantity } = req.body;

      // Validate required fields
      if (!pet_id || !color || !weight || !gender || age === undefined || !import_price || !selling_price) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Missing required fields: pet_id, color, weight, gender, age, import_price, selling_price',
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
        import_price,
        selling_price,
        stock_quantity: stock_quantity || 1
      });

      const savedVariant = await variant.save();
      
      // Populate pet info
      await savedVariant.populate('pet_id', 'name type breed_id');

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Pet variant created successfully',
        data: {
          ...savedVariant.toObject(),
          display_name: savedVariant.getDisplayName()
        }
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
      .populate('pet_id', 'name type breed_id')
      .sort({ created_at: -1 });

      // Thêm display_name cho mỗi variant
      const variantsWithDisplay = variants.map(variant => ({
        ...variant.toObject(),
        display_name: variant.getDisplayName()
      }));

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Pet variants retrieved successfully',
        data: variantsWithDisplay
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
        .populate('pet_id', 'name type breed_id')
        .sort({ created_at: -1 });

      const variantsWithDisplay = variants.map(variant => ({
        ...variant.toObject(),
        display_name: variant.getDisplayName()
      }));

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Filtered variants retrieved successfully',
        data: variantsWithDisplay
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
        .populate('pet_id', 'name type breed_id description status');

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
        message: 'Variant retrieved successfully',
        data: {
          ...variant.toObject(),
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
      ).populate('pet_id', 'name type breed_id');

      if (!updatedVariant) {
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
        message: 'Variant updated successfully',
        data: {
          ...updatedVariant.toObject(),
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
      const sellingPrices = variants.map(v => v.selling_price);

      const ageRange = ages.length > 0 ? { min: Math.min(...ages), max: Math.max(...ages) } : null;
      const weightRange = weights.length > 0 ? { min: Math.min(...weights), max: Math.max(...weights) } : null;
      const priceRange = sellingPrices.length > 0 ? { min: Math.min(...sellingPrices), max: Math.max(...sellingPrices) } : null;

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
          priceRange,
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

  // Lấy thống kê về variants
  async getVariantStatistics(req, res) {
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

      const variants = await PetVariant.find({ pet_id: petId });

      if (variants.length === 0) {
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: 'No variants found for this pet',
          data: {
            totalVariants: 0,
            availableVariants: 0,
            totalStock: 0,
            priceRange: null,
            profitAnalysis: null
          }
        });
      }

      const availableVariants = variants.filter(v => v.is_available);
      const totalStock = variants.reduce((sum, v) => sum + v.stock_quantity, 0);
      const sellingPrices = variants.map(v => v.selling_price);
      const importPrices = variants.map(v => v.import_price);
      
      const priceRange = {
        selling: { min: Math.min(...sellingPrices), max: Math.max(...sellingPrices) },
        import: { min: Math.min(...importPrices), max: Math.max(...importPrices) }
      };

      const profitAnalysis = {
        averageSellingPrice: sellingPrices.reduce((sum, p) => sum + p, 0) / sellingPrices.length,
        averageImportPrice: importPrices.reduce((sum, p) => sum + p, 0) / importPrices.length,
        averageProfit: variants.reduce((sum, v) => sum + (v.selling_price - v.import_price), 0) / variants.length,
        totalPotentialRevenue: variants.reduce((sum, v) => sum + (v.selling_price * v.stock_quantity), 0),
        totalInvestment: variants.reduce((sum, v) => sum + (v.import_price * v.stock_quantity), 0)
      };

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Variant statistics retrieved successfully',
        data: {
          totalVariants: variants.length,
          availableVariants: availableVariants.length,
          totalStock,
          priceRange,
          profitAnalysis
        }
      });

    } catch (error) {
      console.error('Get variant statistics error:', error);
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
  getVariantOptions: petVariantController.getVariantOptions.bind(petVariantController),
  getVariantStatistics: petVariantController.getVariantStatistics.bind(petVariantController)
};