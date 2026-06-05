const { Api } = require("telegram");
const User = require('../models/User');
const { miniAppButton, isGroupChat } = require('../utils/miniAppButton');

const daily = async (client, event) => {
    const userId = event.message.senderId.toString();
    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId });

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const lastDailyStr = user.lastDaily ? user.lastDaily.toISOString().split('T')[0] : null;
    if (lastDailyStr === todayStr) {
        return event.message.respond({ message: `⏳ You already claimed your daily reward today.\n\nCome back tomorrow after 00:00!` });
    }

    const inGroup = isGroupChat(event.chatId);
    const markup = miniAppButton("🚀 Open Mini App & Claim $3,000", "daily", inGroup);

    await client.sendMessage(event.chatId, {
        message: "🛡️ <b>Daily Reward Available!</b>\n\nClick below to open the Mini App and claim your <b>$3,000</b> reward!",
        buttons: markup
    });
};

const missions = async (client, event) => {
    const userId = event.message.senderId.toString();
    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId });

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const lastAdStr = user.lastAdWatchDate ? user.lastAdWatchDate.toISOString().split('T')[0] : null;
    const adsToday = (lastAdStr === todayStr) ? (user.dailyAdsCount || 0) : 0;
    if (adsToday >= 50) {
        return event.message.respond({ message: `⏳ You've already watched all 50 ads today.\n\nCome back tomorrow after 00:00!` });
    }

    const inGroup = isGroupChat(event.chatId);
    const markup = miniAppButton("🎯 Open Mini App & Start Missions", "mission", inGroup);

    await client.sendMessage(event.chatId, {
        message: "📜 <b>Missions Available!</b>\n\nClick below to watch ads for <b>$200</b> each (up to 50 per day)!",
        buttons: markup
    });
};

const deposit = async (client, event) => {
    const userId = event.message.senderId.toString();
    const parts = event.message.message.split(" ");
    const amount = parts[1];
    let user = await User.findOne({ userId }) || await User.create({ userId });
    if (amount === 'all') { user.bank += user.wallet; user.wallet = 0; }
    else {
        const amt = parseInt(amount);
        if (isNaN(amt) || amt <= 0 || amt > user.wallet) return event.message.respond({ message: "Invalid amount." });
        user.bank += amt; user.wallet -= amt;
    }
    await user.save();
    await event.message.respond({ message: `💳 Deposited. Wallet: <b>$${user.wallet}</b> | Bank: <b>$${user.bank}</b>` });
};

const withdraw = async (client, event) => {
    const userId = event.message.senderId.toString();
    const parts = event.message.message.split(" ");
    const amount = parts[1];
    let user = await User.findOne({ userId }) || await User.create({ userId });
    if (amount === 'all') { user.wallet += user.bank; user.bank = 0; }
    else {
        const amt = parseInt(amount);
        if (isNaN(amt) || amt <= 0 || amt > user.bank) return event.message.respond({ message: "Invalid amount." });
        user.wallet += amt; user.bank -= amt;
    }
    await user.save();
    await event.message.respond({ message: `💵 Withdrawn. Wallet: <b>$${user.wallet}</b> | Bank: <b>$${user.bank}</b>` });
};

module.exports = { daily, missions, deposit, withdraw };
