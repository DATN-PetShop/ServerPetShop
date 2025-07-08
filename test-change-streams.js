// test-change-streams.js
require('dotenv').config();
const mongoose = require('mongoose');

async function testChangeStreams() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const ChatMessage = require('./src/models/ChatMessage');
    
    console.log('🔍 Testing Change Streams...');
    
    const changeStream = ChatMessage.watch();
    
    changeStream.on('change', (change) => {
      console.log('🎉 Change detected:', change.operationType);
    });

    changeStream.on('error', (error) => {
      console.error('❌ Change Stream error:', error);
    });

    console.log('✅ Change Stream started. Try inserting a message...');
    
    // Keep process alive
    setInterval(() => {}, 1000);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testChangeStreams();