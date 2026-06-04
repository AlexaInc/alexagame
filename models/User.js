const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: String,
    wallet: { type: Number, default: 500 },
    bank: { type: Number, default: 0 },
    health: { type: Number, default: 100 },
    isDead: { type: Boolean, default: false },
    lastDeath: { type: Date, default: null },
    lastDaily: { type: Date, default: null },
    lastRob: { type: Date, default: null },
    lastKill: { type: Date, default: null },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
});

module.exports = mongoose.model('User', UserSchema);
