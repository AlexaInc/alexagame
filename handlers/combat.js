const User = require('../models/User');
const leveling = require('../utils/leveling');
const { getName } = require('../utils/getName');

const kill = async (client, event) => {
    if (!event.message.replyTo) return event.message.respond({ message: "Reply to someone to kill them!" });

    const killerId = event.message.senderId.toString();
    let replyMsg;
    try {
        replyMsg = await client.getMessages(event.chatId, { ids: [event.message.replyTo.replyToMsgId] });
    } catch (e) { return event.message.respond({ message: "Could not fetch the replied message." }); }
    if (!replyMsg || !replyMsg[0] || !replyMsg[0].senderId)
        return event.message.respond({ message: "You can't kill bots or channels! Reply to a real user." });

    const victimId = replyMsg[0].senderId.toString();
    if (killerId === victimId) return event.message.respond({ message: "You can't kill yourself!" });

    let killer = await User.findOne({ userId: killerId }) || await User.create({ userId: killerId });
    let victim = await User.findOne({ userId: victimId }) || await User.create({ userId: victimId });
    if (victim.isDead) return event.message.respond({ message: "They are already dead!" });

    const reward = Math.floor(Math.random() * 500) + 100;
    killer.wallet += reward;
    killer.kills = (killer.kills || 0) + 1;
    killer.totalEarned = (killer.totalEarned || 0) + reward;
    victim.isDead = true;
    victim.lastDeath = new Date();
    victim.health = 0;

    const xpRes = await leveling.addXP(killerId, 100);
    const killerName = await getName(client, killerId);
    const victimName = await getName(client, victimId);

    let msg = `💀 <b>${killerName}</b> killed <b>${victimName}</b>! Gained $${reward} and 100 XP.`;
    if (xpRes.leveledUp) msg += `\n🆙 <b>LEVEL UP!</b> Level ${xpRes.level}!`;

    await killer.save();
    await victim.save();
    await event.message.respond({ message: msg });
};

const rob = async (client, event) => {
    if (!event.message.replyTo) return event.message.respond({ message: "Reply to someone to rob them!\nUsage: /rob &lt;amount&gt;" });

    const parts = event.message.message.split(" ");
    const amount = parseInt(parts[1]);
    if (isNaN(amount) || amount <= 0) return event.message.respond({ message: "Usage: /rob &lt;amount&gt; (reply to user)\nExample: /rob 500" });

    const robberId = event.message.senderId.toString();
    let replyMsg;
    try {
        replyMsg = await client.getMessages(event.chatId, { ids: [event.message.replyTo.replyToMsgId] });
    } catch (e) { return event.message.respond({ message: "Could not fetch the replied message." }); }
    if (!replyMsg || !replyMsg[0] || !replyMsg[0].senderId)
        return event.message.respond({ message: "You can't rob bots or channels!" });

    const victimId = replyMsg[0].senderId.toString();
    if (robberId === victimId) return event.message.respond({ message: "You can't rob yourself!" });

    let robber = await User.findOne({ userId: robberId }) || await User.create({ userId: robberId });
    let victim = await User.findOne({ userId: victimId }) || await User.create({ userId: victimId });

    const victimName = await getName(client, victimId);
    const robberName = await getName(client, robberId);

    if (victim.wallet <= 0) return event.message.respond({ message: `${victimName} has no money in their wallet to rob!` });
    if (victim.wallet < amount) return event.message.respond({ message: `${victimName} only has <b>$${victim.wallet}</b> in their wallet!` });

    const success = Math.random() < 0.4;

    if (success) {
        robber.wallet += amount;
        robber.robs = (robber.robs || 0) + 1;
        robber.totalEarned = (robber.totalEarned || 0) + amount;
        victim.wallet -= amount;

        const xpRes = await leveling.addXP(robberId, 50);
        let msg = `💸 <b>Robbery Success!</b>\n${robberName} snatched <b>$${amount}</b> from ${victimName}! +50 XP`;
        if (xpRes.leveledUp) msg += `\n🆙 <b>LEVEL UP!</b> Level ${xpRes.level}!`;

        await robber.save();
        await victim.save();
        await event.message.respond({ message: msg });
    } else {
        robber.health -= 10;
        if (robber.health <= 0) {
            robber.isDead = true;
            robber.lastDeath = new Date();
            robber.health = 0;
            await event.message.respond({ message: `👮 <b>CAUGHT!</b> The police beat you up. You are now DEAD.` });
        } else {
            await event.message.respond({ message: `❌ <b>Robbery Failed!</b> You were spotted. Health: ${robber.health}%` });
        }
        await robber.save();
    }
};

const revive = async (client, event) => {
    const userId = event.message.senderId.toString();
    let user = await User.findOne({ userId });
    if (!user || !user.isDead) return event.message.respond({ message: "You are not dead!" });
    const cost = 1000;
    if (user.wallet < cost) return event.message.respond({ message: `You need $${cost} in your wallet to revive!` });
    user.wallet -= cost;
    user.isDead = false;
    user.health = 100;
    await user.save();
    await event.message.respond({ message: "💖 You have been revived! $1000 deducted from wallet." });
};

module.exports = { kill, rob, revive };
