const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/telegram_game_bot';
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,  // 5s to find a server
            socketTimeoutMS: 10000,          // 10s socket timeout
            connectTimeoutMS: 5000,          // 5s connect timeout
            maxPoolSize: 10,                 // limit connection pool
        });
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
    }
};

module.exports = connectDB;
