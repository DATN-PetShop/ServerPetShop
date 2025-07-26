# Real-time Customer Notification System

## Tổng quan (Overview)

Hệ thống thông báo real-time cho khách hàng PetShop được xây dựng với Socket.IO và MongoDB, cho phép gửi thông báo ngay lập tức đến khách hàng về các sự kiện quan trọng như đơn hàng, thanh toán, lịch hẹn, và nhiều hơn nữa.

## Tính năng chính (Key Features)

- 🔔 **Thông báo real-time**: Gửi thông báo ngay lập tức qua Socket.IO
- 👤 **Targeting người dùng**: Thông báo được gửi đến đúng người dùng cụ thể
- 🎯 **Nhiều loại thông báo**: Đơn hàng, thanh toán, lịch hẹn, sản phẩm, voucher, hệ thống
- 📱 **Theo dõi trạng thái online**: Biết được người dùng có đang online không
- 🔢 **Đếm thông báo chưa đọc**: Hiển thị số lượng thông báo chưa đọc
- ✅ **Đánh dấu đã đọc**: Cho phép đánh dấu thông báo đã đọc/chưa đọc
- 📢 **Thông báo broadcast**: Thông báo hệ thống cho tất cả người dùng
- 🔄 **Tự động hóa**: Tích hợp tự động với các luồng nghiệp vụ

## Cài đặt và Cấu hình

### 1. Dependencies đã có
```javascript
// package.json
"socket.io": "^4.8.1"
"mongoose": "^7.8.7"
"jsonwebtoken": "^9.0.2"
```

### 2. Server Setup
Hệ thống đã được tích hợp vào `server.js`:
```javascript
// Socket.IO được cấu hình với CORS
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Notification handlers được khởi tạo trong setupChatServices()
```

## Cách sử dụng

### 1. Frontend Integration (Client)

#### Kết nối Socket.IO
```javascript
// Kết nối đến server
const socket = io('http://localhost:5000');

// Xác thực người dùng
socket.emit('authenticate_notifications', { 
  token: 'your_jwt_token_here' 
});

// Lắng nghe xác thực thành công
socket.on('notification_authenticated', (data) => {
  console.log('Authenticated:', data.user);
  // User: { id, username, role }
});
```

#### Nhận thông báo real-time
```javascript
// Lắng nghe thông báo mới
socket.on('new_notification', (notification) => {
  // notification: {
  //   id, type, message, relatedEntityId, 
  //   relatedEntityType, createdAt, isRead
  // }
  displayNotification(notification);
  updateUnreadCount();
});

// Lắng nghe thông báo broadcast (hệ thống)
socket.on('broadcast_notification', (notification) => {
  displaySystemNotification(notification);
});

// Lắng nghe cập nhật số lượng chưa đọc
socket.on('unread_notifications_count', (data) => {
  updateUnreadBadge(data.count);
});
```

#### Các thao tác với thông báo
```javascript
// Lấy thông báo chưa đọc
socket.emit('get_unread_notifications');
socket.on('unread_notifications', (data) => {
  displayNotifications(data.notifications);
});

// Đánh dấu thông báo đã đọc
socket.emit('mark_notification_read', { 
  notificationId: 'notification_id_here' 
});

// Đánh dấu tất cả đã đọc
socket.emit('mark_all_notifications_read');
```

### 2. REST API Endpoints

```javascript
// Lấy thông báo của người dùng (có phân trang)
GET /api/notification/user/my-notifications?page=1&limit=20&unread_only=false
// Response: { notifications: [...], pagination: {...}, unreadCount: 5 }

// Lấy số lượng thông báo chưa đọc
GET /api/notification/user/unread-count
// Response: { unreadCount: 5 }

// Đánh dấu thông báo đã đọc
PUT /api/notification/:id/read
// Response: { success: true, data: {...} }

// Đánh dấu tất cả thông báo đã đọc
PUT /api/notification/user/mark-all-read
// Response: { success: true, modifiedCount: 3 }
```

### 3. Backend - Gửi thông báo tự động

#### Trong Order Controller
```javascript
// Đã tích hợp sẵn trong src/controllers/orderController.js
const notificationService = req.app.get('notificationService');

// Tự động gửi khi đơn hàng được tạo
await notificationService.notifyOrderCreated(userId, orderId);

// Tự động gửi khi cập nhật trạng thái đơn hàng
await notificationService.notifyOrderConfirmed(userId, orderId);
await notificationService.notifyOrderShipped(userId, orderId);
await notificationService.notifyOrderDelivered(userId, orderId);
```

#### Gửi thông báo thủ công
```javascript
const NotificationService = require('./src/services/notificationService');
const notificationService = req.app.get('notificationService');

// Thông báo thanh toán
await notificationService.notifyPaymentSuccessful(userId, paymentId, amount);

// Thông báo lịch hẹn
await notificationService.notifyAppointmentConfirmed(userId, appointmentId, date);

// Thông báo sản phẩm
await notificationService.notifyProductBackInStock(userId, productId, productName);

// Thông báo voucher
await notificationService.notifyVoucherReceived(userId, voucherId, code, value);

// Thông báo hệ thống (broadcast)
await notificationService.notifySystemMaintenance(time, duration);
```

## Các loại thông báo (Notification Types)

### 1. Đơn hàng (Order)
- `order_created`: Đơn hàng được tạo
- `order_confirmed`: Đơn hàng được xác nhận  
- `order_shipped`: Đơn hàng được giao vận
- `order_delivered`: Đơn hàng đã giao thành công
- `order_cancelled`: Đơn hàng bị hủy

### 2. Thanh toán (Payment)
- `payment_successful`: Thanh toán thành công
- `payment_failed`: Thanh toán thất bại
- `refund_processed`: Hoàn tiền đã xử lý

### 3. Lịch hẹn (Appointment)
- `appointment_confirmed`: Lịch hẹn được xác nhận
- `appointment_reminder`: Nhắc nhở lịch hẹn
- `appointment_cancelled`: Lịch hẹn bị hủy

### 4. Sản phẩm (Product)
- `product_back_in_stock`: Sản phẩm có hàng trở lại
- `product_on_sale`: Sản phẩm đang giảm giá

### 5. Voucher
- `voucher_received`: Nhận được voucher
- `voucher_expiring`: Voucher sắp hết hạn

### 6. Hệ thống (System)
- `system_maintenance`: Bảo trì hệ thống
- `system_update`: Cập nhật hệ thống
- `welcome`: Chào mừng người dùng mới
- `chat_message`: Tin nhắn chat

## Socket Events

### Client → Server
- `authenticate_notifications`: Xác thực người dùng
- `get_unread_notifications`: Lấy thông báo chưa đọc
- `mark_notification_read`: Đánh dấu thông báo đã đọc
- `mark_all_notifications_read`: Đánh dấu tất cả đã đọc

### Server → Client
- `notification_authenticated`: Xác thực thành công
- `notification_auth_error`: Lỗi xác thực
- `new_notification`: Thông báo mới
- `broadcast_notification`: Thông báo broadcast
- `unread_notifications`: Danh sách thông báo chưa đọc
- `unread_notifications_count`: Số lượng chưa đọc
- `notification_marked_read`: Đã đánh dấu đọc
- `all_notifications_marked_read`: Đã đánh dấu tất cả
- `notification_error`: Lỗi thông báo

## Test và Debug

### 1. Test HTML Client
Mở file `test-notification-client.html` trong browser để test:
- Kết nối Socket.IO
- Xác thực người dùng  
- Nhận thông báo real-time
- Quản lý thông báo

### 2. Test Scripts
```bash
# Test cấu trúc hệ thống
node test-simple-notification.js

# Test logic notification (cần MongoDB)
node test-notification-system.js
```

## Lưu ý quan trọng

1. **JWT Token**: Client cần có JWT token hợp lệ để xác thực
2. **MongoDB**: Cần kết nối MongoDB để lưu thông báo
3. **Real-time**: Thông báo chỉ gửi real-time cho user đang online
4. **Offline**: User offline vẫn nhận được thông báo khi quay lại
5. **Performance**: Hệ thống tự động dọn dẹp log và giới hạn số lượng

## Ví dụ Frontend Implementation

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
</head>
<body>
    <div id="notifications"></div>
    <div id="unread-count">0</div>
    
    <script>
        const socket = io('http://localhost:5000');
        
        // Authenticate
        socket.emit('authenticate_notifications', {
            token: localStorage.getItem('jwt_token')  
        });
        
        // Handle new notifications
        socket.on('new_notification', (notification) => {
            const notifEl = document.createElement('div');
            notifEl.innerHTML = `
                <strong>${notification.type}</strong>: 
                ${notification.message}
            `;
            document.getElementById('notifications')
                    .appendChild(notifEl);
        });
        
        // Update unread count
        socket.on('unread_notifications_count', (data) => {
            document.getElementById('unread-count')
                    .textContent = data.count;
        });
    </script>
</body>
</html>
```

## Kết luận

Hệ thống thông báo real-time đã sẵn sàng và có thể:
- ✅ Gửi thông báo ngay lập tức đến khách hàng
- ✅ Tích hợp tự động với các nghiệp vụ hiện có
- ✅ Hỗ trợ nhiều loại thông báo khác nhau
- ✅ Quản lý trạng thái đọc/chưa đọc
- ✅ Compatible với web và mobile apps
- ✅ Dễ dàng mở rộng thêm tính năng mới