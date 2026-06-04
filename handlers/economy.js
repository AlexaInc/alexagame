const { Api } = require("telegram");
const User = require('../models/User');

const daily = async (client, event) => {
    const userId = event.senderId.toString();
    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId });

    const now = new Date();
    if (user.lastDaily && now - user.lastDaily < 24 * 60 * 60 * 1000) {
        const timeLeft = 24 - (now - user.lastDaily) / (1000 * 60 * 60);
        return event.reply({ message: `⏳ You already claimed today. Try again in ${timeLeft.toFixed(1)} hours.` });
    }

    // Send Main Keyboard with Web App button for verification
    // Note: Replace URL with your hosted webapp/index.html URL
    await client.sendMessage(event.chatId, {
        message: "🛡️ **Action Required**\n\nTo prevent bots, you must verify via our Mini App before claiming your daily reward.",
        buttons: client.buildReplyMarkup([
            [Api.KeyboardButton({ 
                text: "🚀 Verify & Claim Reward", 
                webApp: Api.WebAppInfo({ url: "https://your-hosted-webapp.com/index.html" }) 
            })]
        ], { resize: true, singleUse: true })
    });
};

// This handles the data sent back from the Web App via sendData
const handleWebAppData = async (client, event) => {
    if (!event.message || !event.message.webAppData) return;

    const data = event.message.webAppData.data;
    const userId = event.senderId.toString();

    if (data === "verified_daily_ad_high") {
        let user = await User.findOne({ userId });
        const now = new Date();

        if (user.lastDaily && now - user.lastDaily < 24 * 60 * 60 * 1000) return;

        const reward = 3000;
        user.wallet += reward;
        user.lastDaily = now;
        await user.save();

        try {
            await client.sendMessage(userId, {
                message: `🎓 **Daily Reward Successfully Claimed!**\n\nThank you for supporting our mission! **$${reward}** has been added to your wallet.\n\nYour participation helps fund our university education. We appreciate you! 🌟`
            });
        } catch (e) {
            await event.reply({ message: `✅ **Reward Claimed!** $${reward} added to your wallet.` });
        }
    }
};

const deposit = async (client, event) => {
    const userId = event.senderId.toString();
    const parts = event.message.message.split(" ");
    const amount = parts[1];
    let user = await User.findOne({ userId });
    
    if (amount === 'all') {
        user.bank += user.wallet;
        user.wallet = 0;
    } else {
        const amt = parseInt(amount);
        if (isNaN(amt) || amt <= 0 || amt > user.wallet) return event.reply({ message: "Invalid amount." });
        user.bank += amt;
        user.wallet -= amt;
    }
    await user.save();
    await event.reply({ message: `💳 Deposited to bank. Wallet: $${user.wallet} | Bank: $${user.bank}` });
};

const withdraw = async (client, event) => {
    const userId = event.senderId.toString();
    const parts = event.message.message.split(" ");
    const amount = parts[1];
    let user = await User.findOne({ userId });

    if (amount === 'all') {
        user.wallet += user.bank;
        user.bank = 0;
    } else {
        const amt = parseInt(amount);
        if (isNaN(amt) || amt <= 0 || amt > user.bank) return event.reply({ message: "Invalid amount." });
        user.wallet += amt;
        user.bank -= amt;
    }
    await user.save();
    await event.reply({ message: `💵 Withdrawn from bank. Wallet: $${user.wallet} | Bank: $${user.bank}` });
};

module.exports = { daily, handleDailyVerify, deposit, withdraw };
