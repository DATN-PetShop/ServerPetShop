const mongoose = require('mongoose');

const pushTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '30d', // Automatically remove token after 30 days
    },
});

const PushToken = mongoose.model('PushToken', pushTokenSchema);
module.exports = PushToken;
