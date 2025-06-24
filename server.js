require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const userRoutes = require('./src/routes/userRoutes');
const petRoutes = require('./src/routes/petRoutes');
const productRoutes = require('./src/routes/productRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const breedRoutes = require('./src/routes/breedRoutes');
const cartRoutes = require('./src/routes/cartRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');



// Lộc code






// Thắng code

const voucherRoutes = require('./src/routes/voucherRoutes');

// Tri code


// Đức code



// Thủy code




const addressRoutes = require('./src/routes/addressRoutes'); 
const notificationRoutes = require('./src/routes/notificationRoutes'); 
const bannerRoutes = require('./src/routes/bannerRoutes');




const app = express();
app.use(cors());
app.use(express.json());

console.log('MONGODB_URI:', process.env.MONGODB_URI);

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use('/api/users', userRoutes);


app.use('/api/vouchers', voucherRoutes);

//pet
app.use('/api/pets', petRoutes); 

// product
app.use('/api/products', productRoutes);

// categories
app.use('/api/categories', categoryRoutes);

app.use('/api/order', orderRoutes);



app.use('/api/breeds', breedRoutes);


app.use('/api/cart', cartRoutes); 


// thuy code
app.use('/api/payment', paymentRoutes);
app.use('/api/notification', notificationRoutes); // Uncomment if you have notification routes
app.use('/api/addresses', addressRoutes); // Uncomment if you have address routes


app.use('/api/banners', bannerRoutes);

app.get('/', (req, res) => {
  res.send('PetShop Server is running');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});