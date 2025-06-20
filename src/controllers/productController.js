const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
const BaseCrudController = require('./baseCrudController');

class ProductController extends BaseCrudController {
  constructor() {
    super(Product, ProductImage);
  }

  getRequiredFields() {
    return ['name', 'price'];
  }

  getEntityName() {
    return 'Product';
  }

  getImageForeignKey() {
    return 'product_id';
  }
}

const productController = new ProductController();
module.exports = {
  createProduct: productController.create.bind(productController),
  getAllProducts: productController.getAll.bind(productController),
  updateProduct: productController.update.bind(productController),
  deleteProduct: productController.delete.bind(productController)
};