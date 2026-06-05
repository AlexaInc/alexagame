const mongoose = require('mongoose');

const CollectionItemSchema = new mongoose.Schema({
    itemId: String,
    itemName: String,
    from: String,       // 'self' or userId who gifted
    fromName: String,   // display name of gifter
    date: { type: Date, default: Date.now },
}, { _id: false });

const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: String,
    wallet: { type: Number, default: 500 },
    bank: { type: Number, default: 0 },
    health: { type: Number, default: 100 },
    isDead: { type: Boolean, default: false },
    lastDeath: { type: Date, default: null },
    lastDaily: { type: Date, default: null },
    lastMissionClaim: { type: Date, default: null },
    lastInpageMissionClaim: { type: Date, default: null },
    dailyAdsCount: { type: Number, default: 0 },
    lastAdWatchDate: { type: Date, default: null },
    lastRob: { type: Date, default: null },
    lastKill: { type: Date, default: null },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    kills: { type: Number, default: 0 },
    robs: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    // Shop & inventory
    inventory: { type: [CollectionItemSchema], default: [] },
    // Chat activity auto-earn
    lastChatEarnDate: { type: String, default: null }, // 'YYYY-MM-DD'
    chatEarnedToday: { type: Number, default: 0 },
    // Blacklist
    blacklisted: { type: Boolean, default: false },
});

module.exports = mongoose.model('User', UserSchema);
