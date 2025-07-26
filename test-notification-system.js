// test-notification-system.js - Simple test for the notification system
const mongoose = require('mongoose');
require('dotenv').config();

// Set a test MongoDB URI if not provided
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/petshop_test';

async function testNotificationSystem() {
    try {
        console.log('🧪 Testing Notification System...');
        
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Import required models and services
        const User = require('./src/models/User');
        const Notification = require('./src/models/Notification');
        const NotificationService = require('./src/services/notificationService');

        // Create a test user if doesn't exist
        let testUser = await User.findOne({ username: 'test_customer' });
        if (!testUser) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('testpassword', 10);
            
            testUser = await User.create({
                username: 'test_customer',
                email: 'test@example.com',
                password_hash: hashedPassword,
                role: 'User',
                full_name: 'Test Customer',
                phone_number: '0123456789'
            });
            console.log('✅ Test user created:', testUser.username);
        } else {
            console.log('✅ Using existing test user:', testUser.username);
        }

        // Initialize notification service (without socket handler for testing)
        const notificationService = new NotificationService();

        // Test 1: Create welcome notification
        console.log('\n📧 Test 1: Creating welcome notification...');
        const welcomeNotification = await notificationService.notifyWelcomeNewUser(
            testUser._id, 
            testUser.username
        );
        console.log('✅ Welcome notification created:', welcomeNotification.message);

        // Test 2: Create order notification
        console.log('\n📧 Test 2: Creating order notification...');
        const orderNotification = await notificationService.notifyOrderCreated(
            testUser._id, 
            new mongoose.Types.ObjectId()
        );
        console.log('✅ Order notification created:', orderNotification.message);

        // Test 3: Create payment notification
        console.log('\n📧 Test 3: Creating payment notification...');
        const paymentNotification = await notificationService.notifyPaymentSuccessful(
            testUser._id, 
            new mongoose.Types.ObjectId(), 
            299000
        );
        console.log('✅ Payment notification created:', paymentNotification.message);

        // Test 4: Get user notifications
        console.log('\n📧 Test 4: Getting user notifications...');
        const userNotifications = await notificationService.getUserNotifications(testUser._id, 1, 10);
        console.log(`✅ Retrieved ${userNotifications.notifications.length} notifications`);
        console.log(`✅ Unread count: ${userNotifications.unreadCount}`);

        // Test 5: Mark one notification as read
        if (userNotifications.notifications.length > 0) {
            console.log('\n📧 Test 5: Marking notification as read...');
            const firstNotification = userNotifications.notifications[0];
            await Notification.findByIdAndUpdate(firstNotification._id, { is_read: true });
            
            const updatedNotifications = await notificationService.getUserNotifications(testUser._id, 1, 10);
            console.log(`✅ Updated unread count: ${updatedNotifications.unreadCount}`);
        }

        // Test 6: Test different notification types
        console.log('\n📧 Test 6: Testing different notification types...');
        
        const appointmentNotification = await notificationService.notifyAppointmentConfirmed(
            testUser._id, 
            new mongoose.Types.ObjectId(), 
            '2024-01-15 10:00'
        );
        console.log('✅ Appointment notification:', appointmentNotification.type);

        const voucherNotification = await notificationService.notifyVoucherReceived(
            testUser._id, 
            new mongoose.Types.ObjectId(),
            'WELCOME20',
            '20%'
        );
        console.log('✅ Voucher notification:', voucherNotification.type);

        const productNotification = await notificationService.notifyProductBackInStock(
            testUser._id, 
            new mongoose.Types.ObjectId(),
            'Thức ăn cho chó Royal Canin'
        );
        console.log('✅ Product notification:', productNotification.type);

        // Final summary
        console.log('\n📊 Final Summary:');
        const finalNotifications = await notificationService.getUserNotifications(testUser._id, 1, 20);
        console.log(`📧 Total notifications: ${finalNotifications.notifications.length}`);
        console.log(`🔔 Unread notifications: ${finalNotifications.unreadCount}`);
        
        // Show notification types
        const notificationTypes = finalNotifications.notifications.reduce((acc, notif) => {
            acc[notif.type] = (acc[notif.type] || 0) + 1;
            return acc;
        }, {});
        console.log('📋 Notification types:', notificationTypes);

        console.log('\n🎉 All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the test
testNotificationSystem();