require('dotenv').config();
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const connectDB = require('./db/mongo');
const User = require('./models/User');

// Env Check
const requiredEnv = ['API_ID', 'API_HASH', 'BOT_TOKEN', 'MONGO_URI'];
const missing = requiredEnv.filter(k => !process.env[k]);
if (missing.length > 0) {
    console.warn(`⚠️ WARNING: Missing environment variables: ${missing.join(", ")}`);
}

// Handlers
const economy = require('./handlers/economy');
const combat = require('./handlers/combat');
const games = require('./handlers/games');
const multiHack = require('./handlers/multiplayerHack');
const inlineGames = require('./handlers/inlineGames');
const inlineHandler = require('./handlers/inlineHandler');
const boardGames = require('./handlers/boardGames');
const boardHandler = require('./handlers/boardHandler');
const blackjack = require('./handlers/blackjack');
const cardGame = require('./handlers/cardGameHandler');

const apiId = parseInt(process.env.API_ID || 0);
const apiHash = process.env.API_HASH || "";
const botToken = process.env.BOT_TOKEN || "";
const stringSession = new StringSession("");

(async () => {
    await connectDB();
    const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
    await client.start({ botAuthToken: botToken });
    console.log("Bot is running...");

    const isAlive = async (event) => {
        const userId = event.senderId.toString();
        const user = await User.findOne({ userId });
        if (user && user.isDead) {
            if (Date.now() - (user.lastDeath || 0) > 4 * 60 * 60 * 1000) {
                user.isDead = false;
                user.health = 100;
                await user.save();
                return true;
            }
            await event.reply({ message: "💀 You are dead! Use /revive or wait 4 hours." });
            return false;
        }
        return true;
    };

    client.addEventHandler(async (event) => {
        const text = event.message.message;
        if (!text) return;

        if (text === "/start") {
            await event.reply({ message: "🎮 **Game Bot v3**\n\n💰 **Economy**\n/daily, /wallet, /dp <amt>, /wd <amt>\n\n⚔️ **Combat**\n/kill (reply), /rob (reply), /revive\n\n🕹️ **Multiplayer**\n/cards <bet>, /hack <bet> <len>, /join, /xox <bet>, /c4 <bet>, /dice <bet>\n\n🃏 **Casino**\n/bj <bet>, /slots, /mines, /flip, /roulette, /hl" });
        }

        if (text === "/wallet") {
            const userId = event.senderId.toString();
            let user = await User.findOne({ userId });
            if (!user) user = await User.create({ userId, username: event.sender.username });
            await event.reply({ message: `👤 **Level:** ${user.level} | **XP:** ${user.xp}\n💰 **Wallet:** $${user.wallet}\n💳 **Bank:** $${user.bank}\n❤️ **Health:** ${user.health}%` });
        }

        if (text === "/daily") await economy.daily(client, event);
        
        // Handle Mini App Data
        if (event.message && event.message.webAppData) {
            await economy.handleWebAppData(client, event);
        }
        if (text.startsWith("/dp")) await economy.deposit(client, event);
        if (text.startsWith("/wd")) await economy.withdraw(client, event);

        if (text.startsWith("/kill")) { if (await isAlive(event)) await combat.kill(client, event); }
        if (text.startsWith("/rob")) { if (await isAlive(event)) await combat.rob(client, event); }
        if (text === "/revive") await combat.revive(client, event);

        if (text.startsWith("/cards")) { if (await isAlive(event)) await cardGame.initCardGame(client, event); }
        if (text.startsWith("/hack")) { if (await isAlive(event)) await multiHack.initHack(client, event); }
        if (text === "/join") {
            await multiHack.joinHack(client, event);
            await cardGame.joinCardGame(client, event);
        }
        if (text.startsWith("/guess")) await multiHack.processGuess(client, event);
        if (text.startsWith("/flip")) await cardGame.processFlip(client, event);

        if (text.startsWith("/xox")) { if (await isAlive(event)) await boardGames.startXOX(client, event); }
        if (text.startsWith("/c4")) { if (await isAlive(event)) await boardGames.startC4(client, event); }
        if (text.startsWith("/dice")) { if (await isAlive(event)) await games.startDice(client, event); }

        if (text.startsWith("/bj")) { if (await isAlive(event)) await blackjack.startBJ(client, event); }
        if (text === "/slots") await inlineGames.startSlots(client, event);
        if (text === "/mines") await inlineGames.startMines(client, event);
        if (text === "/flip") await inlineGames.startFlip(client, event);
        if (text === "/roulette") await inlineGames.startRoulette(client, event);
        if (text === "/hl") await inlineGames.startHL(client, event);

    }, new NewMessage({}));

    client.addEventHandler(async (update) => {
        if (update instanceof Api.UpdateBotCallbackQuery) {
            await economy.handleDailyVerify(client, update); // Verification for daily
            await games.handleCallback(client, update);
            await games.handleDiceCallback(client, update);
            await inlineHandler.handleInlineCallback(client, update);
            await boardHandler.handleBoardCallback(client, update);
            await blackjack.handleBJCallback(client, update);
            
            try {
                await client.invoke(new Api.messages.SetBotCallbackAnswer({ queryId: update.queryId, cacheTime: 1 }));
            } catch (e) {}
        }
    });
})();
