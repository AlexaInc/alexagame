const User = require('../models/User');

const leveling = require('../utils/leveling');

const kill = async (client, event) => {
    if (!event.message.replyTo) return event.reply({ message: "Reply to someone to kill them!" });
    
    const killerId = event.senderId.toString();
    const replyMsg = await client.getMessages(event.chatId, { ids: event.message.replyTo.replyToMsgId });
    const victimId = replyMsg[0].senderId.toString();

    if (killerId === victimId) return event.reply({ message: "You can't kill yourself!" });

    let killer = await User.findOne({ userId: killerId });
    let victim = await User.findOne({ userId: victimId });

    if (!killer) killer = await User.create({ userId: killerId });
    if (!victim) victim = await User.create({ userId: victimId });

    if (victim.isDead) return event.reply({ message: "They are already dead!" });

    // Reward for killing
    const reward = Math.floor(Math.random() * 500) + 100;
    killer.wallet += reward;
    victim.isDead = true;
    victim.lastDeath = new Date();
    victim.health = 0;

    const xpRes = await leveling.addXP(killerId, 100);
    let msg = `💀 You killed ${victimId}! You gained $${reward} and 100 XP.`;
    if (xpRes.leveledUp) msg += `\n🆙 **LEVEL UP!** You are now level ${xpRes.level}!`;

    await killer.save();
    await victim.save();
    await event.reply({ message: msg });
};

const rob = async (client, event) => {
    if (!event.message.replyTo) return event.reply({ message: "Reply to someone to rob them!" });
    
    const robberId = event.senderId.toString();
    const replyMsg = await client.getMessages(event.chatId, { ids: event.message.replyTo.replyToMsgId });
    const victimId = replyMsg[0].senderId.toString();

    if (robberId === victimId) return event.reply({ message: "You can't rob yourself!" });

    let robber = await User.findOne({ userId: robberId });
    let victim = await User.findOne({ userId: victimId });

    if (!robber) robber = await User.create({ userId: robberId });
    if (!victim) victim = await User.create({ userId: victimId });

    if (victim.wallet <= 0) return event.reply({ message: "They have no money in their wallet to rob!" });

    const success = Math.random() < 0.4;
    
    if (success) {
        const stolen = Math.floor(Math.random() * (victim.wallet * 0.7)) + 1;
        robber.wallet += stolen;
        victim.wallet -= stolen;
        
        const xpRes = await leveling.addXP(robberId, 50);
        let msg = `💸 **Robbery Success!**\nYou snatched $${stolen} and 50 XP!`;
        if (xpRes.leveledUp) msg += `\n🆙 **LEVEL UP!** You are now level ${xpRes.level}!`;
        
        await robber.save();
        await victim.save();
        await event.reply({ message: msg });
    } else {
        robber.health -= 10;
        if (robber.health <= 0) {
            robber.isDead = true;
            robber.lastDeath = new Date();
            robber.health = 0;
            await event.reply({ message: `👮 **CAUGHT!** The police beat you up. You are now DEAD.` });
        } else {
            await event.reply({ message: `❌ **Robbery Failed!** You were spotted. Health: ${robber.health}%` });
        }
        await robber.save();
    }
};

const revive = async (client, event) => {
    const userId = event.senderId.toString();
    let user = await User.findOne({ userId });

    if (!user || !user.isDead) return event.reply({ message: "You are not dead!" });

    const cost = 1000;
    if (user.wallet < cost) return event.reply({ message: `You need $${cost} in your wallet to revive!` });

    user.wallet -= cost;
    user.isDead = false;
    user.health = 100;
    await user.save();

    await event.reply({ message: "💖 You have been revived! $1000 deducted from wallet." });
};

module.exports = { kill, rob, revive };
