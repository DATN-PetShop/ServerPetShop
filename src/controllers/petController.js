const Pet = require('../models/Pet');
const Image = require('../models/ImagePet');

// POST /api/pets
const createPet = async (req, res) => {
  try {
    const { name, price, age, weight, gender, description, status, type, breed_id, images } = req.body;

    if (!name || !type) {
      return res.status(400).json({ message: 'Missing name or type' });
    }

    const pet = new Pet({
      name, price, age, weight, gender, description, status, type,
      user_id: req.user.userId,
      breed_id
    });

    const savedPet = await pet.save();

    // Nếu có images truyền vào:
    if (Array.isArray(images)) {
      const imageDocs = images.map(img => ({
        url: img.url,
        is_primary: img.is_primary || false,
        pet_id: savedPet._id
      }));
      await Image.insertMany(imageDocs);
    }

    res.status(201).json({ message: 'Pet created', data: savedPet });

  } catch (error) {
    console.error('Create pet error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/pets
const getMyPets = async (req, res) => {
  try {
    const pets = await Pet.find({ user_id: req.user.userId })
      .lean();

    // Gắn thêm hình ảnh từ model `Image`
    const petIds = pets.map(p => p._id);
    const images = await Image.find({ pet_id: { $in: petIds } });

    const petsWithImages = pets.map(pet => {
      const petImages = images.filter(img => img.pet_id.toString() === pet._id.toString());
      return { ...pet, images: petImages };
    });

    res.status(200).json({ data: petsWithImages });

  } catch (error) {
    console.error('Fetch pets error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/pets/:id
const updatePet = async (req, res) => {
  try {
    const updatedPet = await Pet.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.userId },
      req.body,
      { new: true }
    );

    if (!updatedPet) return res.status(404).json({ message: 'Pet not found' });

    res.status(200).json({ message: 'Pet updated', data: updatedPet });

  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/pets/:id
const deletePet = async (req, res) => {
  try {
    const deletedPet = await Pet.findOneAndDelete({
      _id: req.params.id,
      user_id: req.user.userId
    });

    if (!deletedPet) return res.status(404).json({ message: 'Pet not found' });

    // Xoá luôn ảnh liên quan
    await Image.deleteMany({ pet_id: deletedPet._id });

    res.status(200).json({ message: 'Pet and images deleted' });

  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  createPet,
  getMyPets,
  updatePet,
  deletePet
};
