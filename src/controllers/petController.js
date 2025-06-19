const Pet = require('../models/Pet');
const Image = require('../models/ImagePet');
const BaseCrudController = require('./baseCrudController');

class PetController extends BaseCrudController {
  constructor() {
    super(Pet, Image);
  }

  getRequiredFields() {
    return ['name', 'price', 'type']; 
  }

  getEntityName() {
    return 'Pet';
  }

  getImageForeignKey() {
    return 'pet_id';
  }

  async getAllPetsPublic(req, res) {
    try {
      const pets = await this.model.find()
        .populate('breed_id', 'name description')
        // .populate('user_id', 'username email')
        .lean();

      // Populate images
      if (this.imageModel) {
        for (let pet of pets) {
          const images = await this.imageModel.find({ [this.getImageForeignKey()]: pet._id }).lean();
          pet.images = images;
        }
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'All pets retrieved successfully',
        data: pets
      });
    } catch (error) {
      console.error('Get all pets public error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }

  async getAllPetsAdmin(req, res) {
    try {
      const pets = await this.model.find()
        .populate('breed_id', 'name description')
        .populate('user_id', 'username email role')
        .lean();

      if (this.imageModel) {
        for (let pet of pets) {
          const images = await this.imageModel.find({ [this.getImageForeignKey()]: pet._id }).lean();
          pet.images = images;
        }
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'All pets for admin retrieved successfully',
        data: pets
      });
    } catch (error) {
      console.error('Get all pets admin error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
        data: null
      });
    }
  }
}

const petController = new PetController();

module.exports = {
  createPet: petController.create.bind(petController),
  getAllPetsPublic: petController.getAllPetsPublic.bind(petController),
  getAllPetsAdmin: petController.getAllPetsAdmin.bind(petController), 
  updatePet: petController.update.bind(petController),
  deletePet: petController.delete.bind(petController)
};