const User = require('../models/User');

const addXP = async (userId, amount) => {
    let user = await User.findOne({ userId });
    if (!user) return;

    user.xp += amount;
    const nextLevelXP = user.level * 1000;

    if (user.xp >= nextLevelXP) {
        user.level += 1;
        user.xp = 0; // Reset or keep overflow? Let's reset for simplicity
        // Return true if leveled up
        await user.save();
        return { leveledUp: true, level: user.level };
    }
    await user.save();
    return { leveledUp: false };
};

module.exports = { addXP };
