/**
 * Auto-earn money for chatting in groups.
 * Max $1000 per day per user, small random amount per message.
 */
const User = require('../models/User');

const MAX_DAILY = 1000;
const MIN_PER_MSG = 1;
const MAX_PER_MSG = 15;

async function processChatEarn(userId) {
    try {
        let user = await User.findOne({ userId });
        if (!user) user = await User.create({ userId });
        if (user.blacklisted) return;

        const today = new Date().toISOString().split('T')[0];

        if (user.lastChatEarnDate !== today) {
            user.lastChatEarnDate = today;
            user.chatEarnedToday = 0;
        }

        if (user.chatEarnedToday >= MAX_DAILY) return;

        const earn = Math.floor(Math.random() * (MAX_PER_MSG - MIN_PER_MSG + 1)) + MIN_PER_MSG;
        const actual = Math.min(earn, MAX_DAILY - user.chatEarnedToday);

        user.wallet += actual;
        user.chatEarnedToday += actual;
        await user.save();
    } catch (e) {}
}

module.exports = { processChatEarn };
