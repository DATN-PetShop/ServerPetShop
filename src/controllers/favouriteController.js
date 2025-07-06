const Favourite = require('../models/Favourite');

class FavouriteController {
  // Thêm yêu thích
  async add(req, res) {
    try {
      const user_id = req.user.userId;
      const { product_id } = req.body;

      if (!product_id) return res.status(400).json({ success: false, message: 'Thiếu product_id' });

      const favourite = new Favourite({ user_id, product_id });
      await favourite.save();

      res.status(201).json({ success: true, message: 'Đã thêm vào yêu thích' });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ success: false, message: 'Sản phẩm đã có trong yêu thích' });
      }
      res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }
  }

  // Xoá yêu thích
  async remove(req, res) {
    try {
      const user_id = req.user.userId;
      const { product_id } = req.body;

      const deleted = await Favourite.findOneAndDelete({ user_id, product_id });
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy mục yêu thích' });
      }

      res.status(200).json({ success: true, message: 'Đã xoá khỏi yêu thích' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }
  }

  // Xem danh sách yêu thích
  async getAll(req, res) {
    try {
      const user_id = req.user.userId;
      const favourites = await Favourite.find({ user_id }).populate('product_id');

      res.status(200).json({ success: true, data: favourites });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }
  }
}

const controller = new FavouriteController();
module.exports = {
  addFavourite: controller.add.bind(controller),
  removeFavourite: controller.remove.bind(controller),
  getFavourites: controller.getAll.bind(controller),
};
