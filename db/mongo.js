const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Using a local mongo or a placeholder URI. 
        // User should provide their own MONGO_URI in .env
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/telegram_game_bot';
        await mongoose.connect(uri);
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
    }
};

module.exports = connectDB;
