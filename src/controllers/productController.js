const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');

const createProduct = async (req, res) => {
  try {
    const { name, description, price, stock, status, category_id, images } = req.body;

    if (!name || !price) {
      return res.status(400).json({ message: 'Name and price are required' });
    }

    const product = new Product({
      name,
      description,
      price,
      stock,
      status,
      category_id,
      user_id: req.user.userId
    });

    const savedProduct = await product.save();

    if (Array.isArray(images)) {
      const imageDocs = images.map(img => ({
        url: img.url,
        is_primary: img.is_primary || false,
        product_id: savedProduct._id
      }));
      await ProductImage.insertMany(imageDocs);
    }

    res.status(201).json({ message: 'Product created', data: savedProduct });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().lean();
    const productIds = products.map(p => p._id);
    const images = await ProductImage.find({ product_id: { $in: productIds } });

    const full = products.map(p => ({
      ...p,
      images: images.filter(img => img.product_id.toString() === p._id.toString())
    }));

    res.status(200).json({ data: full });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const updated = await Product.findOneAndUpdate(
      { _id: req.params.id },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json({ data: updated });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Product not found' });

    await ProductImage.deleteMany({ product_id: deleted._id });
    res.status(200).json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  updateProduct,
  deleteProduct
};
