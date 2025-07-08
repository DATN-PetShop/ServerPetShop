// server.js - CẬP NHẬT VỚI SOCKET.IO
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

// Import existing routes
const userRoutes = require('./src/routes/userRoutes');
const petRoutes = require('./src/routes/petRoutes');
const productRoutes = require('./src/routes/productRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const breedRoutes = require('./src/routes/breedRoutes');
const cartRoutes = require('./src/routes/cartRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const voucherRoutes = require('./src/routes/voucherRoutes');
const addressRoutes = require('./src/routes/addressRoutes'); 
const notificationRoutes = require('./src/routes/notificationRoutes'); 
const bannerRoutes = require('./src/routes/bannerRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const vnpayRoutes = require('./src/routes/vnpayRoutes');
const orderItemRoutes = require('./src/routes/orderItemRoutes');
const favouriteRoutes = require('./src/routes/favouriteRoutes');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*", // Cho phép tất cả kết nối
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

console.log('MONGODB_URI:', process.env.MONGODB_URI);

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
    setupChatServices();
  })
  .catch((err) => console.error('MongoDB connection error:', err));


app.use('/api/users', userRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/pets', petRoutes); 
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/breeds', breedRoutes);
app.use('/api/cart', cartRoutes); 
app.use('/api/payment', paymentRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/chat', chatRoutes);

app.use('/api/order_items', orderItemRoutes);
app.use('/', vnpayRoutes);
app.use('/api/favourites', favouriteRoutes);
app.get('/', (req, res) => {
  res.send('PetShop Server is running');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO ready for connections`);
});

function setupChatServices() {
  try {
    const ChatSocketHandler = require('./src/socket/chatSocketHandler');
    const socketHandler = new ChatSocketHandler(io);
    app.set('socketHandler', socketHandler);
    console.log('✅ Socket handler registered with Express app');
    const ChatRealtimeService = require('./src/services/chatRealtimeService');
    const chatRealtimeService = new ChatRealtimeService(socketHandler);
    
    chatRealtimeService.startWatching();

    app.set('socketHandler', socketHandler);
    app.set('chatRealtimeService', chatRealtimeService);

    process.on('SIGTERM', () => {
      console.log('🛑 Shutting down gracefully...');
      chatRealtimeService.stopWatching();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('🛑 Shutting down gracefully...');
      chatRealtimeService.stopWatching();
      process.exit(0);
    });

    console.log('✅ Chat services initialized successfully');

  } catch (error) {
  }
}