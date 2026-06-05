const fs = require('fs');
const path = require('path');
const { Api } = require("telegram");
const User = require('../models/User');
const { SHOP_ITEMS, getItem, calcXP } = require('../data/shopItems');
const leveling = require('../utils/leveling');
const { getName } = require('../utils/getName');

// ── Pick random gif from ./gifs/<dir>/ ──
function getRandomGif(gifDir) {
    const dir = path.join(__dirname, '..', 'gifs', gifDir);
    try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.gif'));
        if (files.length === 0) return null;
        return path.join(dir, files[Math.floor(Math.random() * files.length)]);
    } catch (e) { return null; }
}

// ── /shop ──
const shop = async (client, event) => {
    let msg = `🛒 <b>SHOP</b>\n\n`;
    msg += `<code>ID  | Item           | Price</code>\n`;
    msg += `<code>----|----------------|--------</code>\n`;
    for (const item of SHOP_ITEMS) {
        const id = item.id.padEnd(3);
        const name = `${item.emoji} ${item.name}`.padEnd(16);
        msg += `<code>${id} | ${name}| $${item.price}</code>\n`;
    }
    msg += `\n💰 /buy &lt;id&gt; — buy for yourself`;
    msg += `\n🎁 /gift &lt;id&gt; — gift to someone (reply to user)`;
    msg += `\n📦 /collection — view your inventory`;
    await event.message.respond({ message: msg });
};

// ── /buy <id> ──
const buy = async (client, event) => {
    const userId = event.message.senderId.toString();
    const itemId = event.message.message.split(" ")[1];
    if (!itemId) return event.message.respond({ message: "Usage: /buy &lt;item id&gt;\nSee /shop for item list." });

    const item = getItem(itemId);
    if (!item) return event.message.respond({ message: "❌ Item not found! Use /shop to see items." });

    let user = await User.findOne({ userId }) || await User.create({ userId });
    if (user.wallet < item.price) return event.message.respond({ message: `❌ Not enough money! Need <b>$${item.price}</b>, you have $${user.wallet}.` });

    const buyerName = await getName(client, userId);

    user.wallet -= item.price;
    const xpGain = calcXP(item.price);
    user.inventory.push({
        itemId: item.id,
        itemName: item.name,
        from: 'self',
        fromName: buyerName,
    });
    await user.save();
    await leveling.addXP(userId, xpGain);

    const msg = `${item.emoji} <b>${buyerName}</b> bought a <b>${item.name}</b>!\n\n💰 -$${item.price} | ✨ +${xpGain} XP`;

    const gif = getRandomGif(item.gifDir);
    if (gif) {
        try {
            await client.sendMessage(event.chatId, { message: msg, file: gif });
            return;
        } catch (e) { console.error('[shop] gif send failed:', e.message); }
    }
    await event.message.respond({ message: msg });
};

// ── /gift <id> (reply to user) ──
const gift = async (client, event) => {
    if (!event.message.replyTo) return event.message.respond({ message: "Reply to someone to gift them an item!\nUsage: /gift &lt;item id&gt;" });

    const gifterId = event.message.senderId.toString();
    const itemId = event.message.message.split(" ")[1];
    if (!itemId) return event.message.respond({ message: "Usage: /gift &lt;item id&gt;\nSee /shop for item list." });

    const item = getItem(itemId);
    if (!item) return event.message.respond({ message: "❌ Item not found! Use /shop to see items." });

    let replyMsg;
    try {
        replyMsg = await client.getMessages(event.chatId, { ids: [event.message.replyTo.replyToMsgId] });
    } catch (e) { return event.message.respond({ message: "Could not fetch replied message." }); }
    if (!replyMsg || !replyMsg[0] || !replyMsg[0].senderId)
        return event.message.respond({ message: "Can't gift to bots or channels!" });

    const receiverId = replyMsg[0].senderId.toString();
    if (gifterId === receiverId) return event.message.respond({ message: "Use /buy to get items for yourself!" });

    let gifter = await User.findOne({ userId: gifterId }) || await User.create({ userId: gifterId });
    if (gifter.wallet < item.price) return event.message.respond({ message: `❌ Not enough money! Need <b>$${item.price}</b>, you have $${gifter.wallet}.` });

    let receiver = await User.findOne({ userId: receiverId }) || await User.create({ userId: receiverId });

    const gifterName = await getName(client, gifterId);
    const receiverName = await getName(client, receiverId);

    gifter.wallet -= item.price;
    const xpGain = calcXP(item.price);
    await gifter.save();
    await leveling.addXP(gifterId, xpGain);

    receiver.inventory.push({
        itemId: item.id,
        itemName: item.name,
        from: gifterId,
        fromName: gifterName,
    });
    await receiver.save();

    const msg = `🎁 <b>${gifterName}</b> gifted a <b>${item.emoji} ${item.name}</b> to <b>${receiverName}</b>!\n\n💰 -$${item.price} | ✨ +${xpGain} XP for ${gifterName}`;

    const gif = getRandomGif(item.gifDir);
    if (gif) {
        try {
            await client.sendMessage(event.chatId, { message: msg, file: gif });
            return;
        } catch (e) { console.error('[shop] gif send failed:', e.message); }
    }
    await event.message.respond({ message: msg });
};

// ── /collection (or /collection reply to user) ──
const inventory = async (client, event) => {
    let targetId = event.message.senderId.toString();
    let targetName = await getName(client, targetId);

    if (event.message.replyTo) {
        try {
            const replyMsg = await client.getMessages(event.chatId, { ids: [event.message.replyTo.replyToMsgId] });
            if (replyMsg && replyMsg[0] && replyMsg[0].senderId) {
                targetId = replyMsg[0].senderId.toString();
                targetName = await getName(client, targetId);
            }
        } catch (e) {}
    }

    let user = await User.findOne({ userId: targetId });
    if (!user || !user.inventory || user.inventory.length === 0)
        return event.message.respond({ message: `📦 <b>${targetName}'s Collection</b>\n\n<i>Empty — no items yet!</i>\n\nUse /shop to browse items.` });

    let msg = `📦 <b>${targetName}'s Collection</b>\n\n`;
    for (const item of user.inventory) {
        const shopItem = getItem(item.itemId);
        const emoji = shopItem ? shopItem.emoji : '📦';
        if (item.from === 'self') {
            msg += `${emoji} <b>${item.itemName}</b> — bought by themselves\n`;
        } else {
            msg += `${emoji} <b>${item.itemName}</b> — gifted by ${item.fromName}\n`;
        }
    }
    await event.message.respond({ message: msg });
};

module.exports = { shop, buy, gift, inventory };
