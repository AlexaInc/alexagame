const User = require('../models/User');
const { getName } = require('../utils/getName');

// Bot owner ID — set in .env as BOT_OWNER_ID
function isOwner(userId) {
    const ownerId = process.env.BOT_OWNER_ID;
    return ownerId && userId === ownerId;
}

// ── /add <value> (reply to user or /add <value> <userId>) ──
const addMoney = async (client, event) => {
    const userId = event.message.senderId.toString();
    if (!isOwner(userId)) return;

    const parts = event.message.message.split(" ");
    const amount = parseInt(parts[1]);
    if (isNaN(amount) || amount <= 0) return event.message.respond({ message: "Usage: /add &lt;amount&gt; (reply to user)" });

    let targetId = parts[2]; // /add 500 userId
    if (!targetId && event.message.replyTo) {
        try {
            const replyMsg = await client.getMessages(event.chatId, { ids: [event.message.replyTo.replyToMsgId] });
            if (replyMsg && replyMsg[0] && replyMsg[0].senderId) targetId = replyMsg[0].senderId.toString();
        } catch (e) {}
    }
    if (!targetId) return event.message.respond({ message: "Reply to a user or provide user ID: /add &lt;amount&gt; &lt;userId&gt;" });

    let user = await User.findOne({ userId: targetId }) || await User.create({ userId: targetId });
    user.wallet += amount;
    await user.save();

    const name = await getName(client, targetId);
    await event.message.respond({ message: `✅ Added <b>$${amount}</b> to ${name}'s wallet. New balance: <b>$${user.wallet}</b>` });
};

// ── /addblacklist (reply or /addblacklist <userId>) ──
const addBlacklist = async (client, event) => {
    const userId = event.message.senderId.toString();
    if (!isOwner(userId)) return;

    let targetId = event.message.message.split(" ")[1];
    if (!targetId && event.message.replyTo) {
        try {
            const replyMsg = await client.getMessages(event.chatId, { ids: [event.message.replyTo.replyToMsgId] });
            if (replyMsg && replyMsg[0] && replyMsg[0].senderId) targetId = replyMsg[0].senderId.toString();
        } catch (e) {}
    }
    if (!targetId) return event.message.respond({ message: "Reply to a user or: /addblacklist &lt;userId&gt;" });

    let user = await User.findOne({ userId: targetId }) || await User.create({ userId: targetId });
    user.blacklisted = true;
    await user.save();

    const name = await getName(client, targetId);
    await event.message.respond({ message: `🚫 <b>${name}</b> (${targetId}) has been blacklisted.` });
};

// ── /unblacklist ──
const unBlacklist = async (client, event) => {
    const userId = event.message.senderId.toString();
    if (!isOwner(userId)) return;

    let targetId = event.message.message.split(" ")[1];
    if (!targetId && event.message.replyTo) {
        try {
            const replyMsg = await client.getMessages(event.chatId, { ids: [event.message.replyTo.replyToMsgId] });
            if (replyMsg && replyMsg[0] && replyMsg[0].senderId) targetId = replyMsg[0].senderId.toString();
        } catch (e) {}
    }
    if (!targetId) return event.message.respond({ message: "Reply to a user or: /unblacklist &lt;userId&gt;" });

    let user = await User.findOne({ userId: targetId });
    if (!user) return event.message.respond({ message: "User not found." });
    user.blacklisted = false;
    await user.save();

    const name = await getName(client, targetId);
    await event.message.respond({ message: `✅ <b>${name}</b> (${targetId}) removed from blacklist.` });
};

// ── /blacklist ──
const showBlacklist = async (client, event) => {
    const userId = event.message.senderId.toString();
    if (!isOwner(userId)) return;

    const users = await User.find({ blacklisted: true }).select('userId username').lean();
    if (users.length === 0) return event.message.respond({ message: "📋 Blacklist is empty." });

    let msg = `🚫 <b>Blacklisted Users</b>\n\n`;
    for (const u of users) {
        const name = u.username || `User${u.userId.slice(-4)}`;
        msg += `• ${name} — <code>${u.userId}</code>\n`;
    }
    await event.message.respond({ message: msg });
};

module.exports = { addMoney, addBlacklist, unBlacklist, showBlacklist, isOwner };
