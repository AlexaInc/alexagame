require('dotenv').config();
global.crypto = require('crypto');
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const connectDB = require('./db/mongo');
const User = require('./models/User');
const { startApi } = require('./api');
const { processChatEarn } = require('./utils/chatEarn');
const { getName } = require('./utils/getName');
const { isGroupChat, miniAppButton, getBotUsername, getWebAppUrl } = require('./utils/miniAppButton');

const requiredEnv = ['API_ID', 'API_HASH', 'BOT_TOKEN', 'MONGO_URI'];
const missing = requiredEnv.filter(k => !process.env[k]);
if (missing.length > 0) console.warn(`⚠️ Missing env: ${missing.join(", ")}`);

const economy = require('./handlers/economy');
const combat = require('./handlers/combat');
const games = require('./handlers/games');
const multiHack = require('./handlers/multiplayerHack');
const inlineGames = require('./handlers/inlineGames');
const inlineHandler = require('./handlers/inlineHandler');
const boardGames = require('./handlers/boardGames');
const boardHandler = require('./handlers/boardHandler');
const blackjack = require('./handlers/blackjack');
const strategy = require('./handlers/strategyGames');
const shopHandler = require('./handlers/shop');
const admin = require('./handlers/admin');
const carrom = require('./handlers/carrom');
const webCards = require('./handlers/webCards');
const omi = require('./handlers/omi');

const apiId = parseInt(process.env.API_ID || 0);
const apiHash = process.env.API_HASH || "";
const botToken = process.env.BOT_TOKEN || "";
const stringSession = new StringSession("");

const MP_FALLBACK = "⚠️ This command only works in groups! Add me to a group to play multiplayer games.";

(async () => {
    await connectDB();
    startApi();
    const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
    await client.start({ botAuthToken: botToken });
    console.log("Bot is running...");
    global._tgClient = client;
    client.setParseMode('html');

    const isAlive = async (event) => {
        const userId = event.message.senderId.toString();
        const user = await User.findOne({ userId });
        if (user && user.isDead) {
            if (Date.now() - (user.lastDeath || 0) > 4 * 60 * 60 * 1000) {
                user.isDead = false; user.health = 100; await user.save(); return true;
            }
            await event.message.respond({ message: "💀 You are dead! Use /revive or wait 4 hours." });
            return false;
        }
        return true;
    };

    const isBlacklisted = async (userId) => {
        const user = await User.findOne({ userId });
        return user && user.blacklisted;
    };

    const requireGroup = (event) => {
        if (!isGroupChat(event.chatId)) {
            event.message.respond({ message: MP_FALLBACK });
            return false;
        }
        return true;
    };

    /**
     * Strip @botusername from command text.
     * "/chess@Alexagamebot 500" → "/chess 500"
     * "/daily@Alexagamebot" → "/daily"
     */
    function stripBotMention(text) {
        return text.replace(/@\w+/i, '');
    }

    /**
     * Check if text matches a command (handles @botusername suffix).
     * cmd("/daily", text) matches "/daily" and "/daily@Alexagamebot"
     */
    function cmd(command, text) {
        return text === command || text.startsWith(command + '@') || text.startsWith(command + ' ');
    }

    /**
     * Check if text starts with a command (handles @botusername).
     * cmdStart("/chess", text) matches "/chess 500" and "/chess@Bot 500"
     */
    function cmdStart(command, text) {
        return text.startsWith(command + ' ') || text.startsWith(command + '@') || text === command;
    }

    client.addEventHandler(async (event) => {
        const rawText = event.message.message || '';
        const userId = event.message.senderId?.toString();
        if (!userId) return;

        // Auto-earn from chatting (non-commands, groups only)
        if (rawText && !rawText.startsWith('/')) {
            if (isGroupChat(event.chatId)) await processChatEarn(userId);
            return;
        }
        if (!rawText) return;

        // Strip @botusername from the command for matching
        const text = stripBotMention(rawText);

        // Blacklist check
        if (text.startsWith('/') && await isBlacklisted(userId)) return;

        // ── Admin ──
        if (cmdStart("/add", text) && !cmdStart("/addblacklist", text)) await admin.addMoney(client, event);
        if (cmdStart("/addblacklist", text)) await admin.addBlacklist(client, event);
        if (cmdStart("/unblacklist", text)) await admin.unBlacklist(client, event);
        if (cmd("/blacklist", text)) await admin.showBlacklist(client, event);

        // ── /start — handle startapp params for mini app deep links ──
        if (text === "/start" || text.startsWith("/start ")) {
            const parts = text.split(" ");
            const startParam = parts[1] || '';

            // Handle startapp deep links (carrom, daily, mission, etc.)
            if (startParam.startsWith('omi_')) {
                const webUrl = getWebAppUrl() + '/omi.html?tgWebAppStartParam=' + startParam;
                await client.sendMessage(event.chatId, {
                    message: "🃏 <b>Omi</b>\n\nClick below to open!",
                    buttons: new Api.ReplyInlineMarkup({ rows: [new Api.KeyboardButtonRow({ buttons: [
                        new Api.KeyboardButtonWebView({ text: "🃏 Open Omi", url: webUrl })
                    ]})] })
                });
                return;
            }
            if (startParam.startsWith('wcards_')) {
                const webUrl = getWebAppUrl() + '/cards.html?tgWebAppStartParam=' + startParam;
                await client.sendMessage(event.chatId, {
                    message: "🃏 <b>Card Game</b>\n\nClick below to open!",
                    buttons: new Api.ReplyInlineMarkup({ rows: [new Api.KeyboardButtonRow({ buttons: [
                        new Api.KeyboardButtonWebView({ text: "🃏 Open Cards", url: webUrl })
                    ]})] })
                });
                return;
            }
            if (startParam.startsWith('carrom_')) {
                // Send mini app button to open carrom game
                const webUrl = getWebAppUrl() + '/carrom?tgWebAppStartParam=' + startParam;
                await client.sendMessage(event.chatId, {
                    message: "🎯 <b>Carrom Pool</b>\n\nClick below to open the game!",
                    buttons: new Api.ReplyInlineMarkup({
                        rows: [new Api.KeyboardButtonRow({ buttons: [
                            new Api.KeyboardButtonWebView({ text: "🎮 Open Carrom", url: webUrl })
                        ]})]
                    })
                });
                return;
            }

            if (startParam === 'daily') {
                await economy.daily(client, event);
                return;
            }

            if (startParam === 'mission') {
                await economy.missions(client, event);
                return;
            }

            // Default /start — show help
            await event.message.respond({ message:
                "🎮 <b>Alexagame Bot</b>\n\n" +
                "💰 /daily — Claim $3000 daily reward\n" +
                "💰 /wallet — Balance &amp; stats\n" +
                "🛒 /shop — Browse items\n" +
                "🛍️ /buy &lt;id&gt; — Buy item\n" +
                "🎁 /gift &lt;id&gt; — Gift item (reply)\n" +
                "📦 /collection — View collection\n\n" +
                "<b>⚔️ Combat (groups only)</b>\n" +
                "/kill (reply) — Kill for cash\n" +
                "/rob &lt;amount&gt; (reply) — Rob user\n" +
                "/revive — Revive for $1000\n\n" +
                "<b>🎮 Multiplayer (groups only)</b>\n" +
                "♔ /chess &lt;bet&gt; — Chess\n" +
                "⚪ /checkers &lt;bet&gt; — Checkers\n" +
                "❌ /xox &lt;bet&gt; — Tic-Tac-Toe 8×8\n" +
                "🔴 /c4 &lt;bet&gt; — Connect 4 8×8\n" +
                "🎲 /dice &lt;bet&gt; — Dice duel\n" +
                "🎯 /carrom &lt;bet&gt; — Carrom Pool\n" +
                "🔓 /hack &lt;bet&gt; &lt;len&gt; — PIN hack\n" +
                "🃏 /cards &lt;bet&gt; — Card Game\n" +
                "🃏 /omi &lt;bet&gt; — Omi (trick-taking)\n\n" +
                "<b>🎰 Solo Casino</b>\n" +
                "/bj &lt;bet&gt; — Blackjack\n" +
                "/slots — Slots | /mines — Mines\n" +
                "/coin — Coin flip | /hl — High/Low\n" +
                "/roulette — Russian roulette\n\n" +
                "🏳️ /surrender — Forfeit game\n" +
                "💬 Chat in groups to earn up to $1000/day!"
            });
            return;
        }

        // ── Wallet (works everywhere) ──
        if (cmd("/wallet", text)) {
            let targetId = userId;
            if (event.message.replyTo) {
                try {
                    const replyMsg = await client.getMessages(event.chatId, { ids: [event.message.replyTo.replyToMsgId] });
                    if (replyMsg?.[0]?.senderId) targetId = replyMsg[0].senderId.toString();
                } catch (e) {}
            }
            let user = await User.findOne({ userId: targetId }) || await User.create({ userId: targetId });
            const name = await getName(client, targetId);
            await event.message.respond({ message:
                `👤 <b>${name}</b>${targetId === userId ? '' : "'s wallet"}\n` +
                `🎖️ Lv.${user.level} | XP: ${user.xp}\n` +
                `💰 Wallet: <b>$${user.wallet}</b>\n` +
                `💳 Bank: <b>$${user.bank}</b>\n` +
                `❤️ HP: ${user.health}%\n` +
                `💀 Kills: ${user.kills||0} | 💸 Robs: ${user.robs||0}\n` +
                `📦 Items: ${user.inventory?.length || 0}`
            });
        }

        // ── Economy (works everywhere) ──
        if (cmd("/daily", text)) await economy.daily(client, event);
        if (cmd("/missions", text)) await economy.missions(client, event);
        if (cmdStart("/dp", text)) await economy.deposit(client, event);
        if (cmdStart("/wd", text)) await economy.withdraw(client, event);

        // ── Shop (works everywhere) ──
        if (cmd("/shop", text)) await shopHandler.shop(client, event);
        if (cmdStart("/buy", text)) await shopHandler.buy(client, event);
        if (cmdStart("/gift", text) && event.message.replyTo) await shopHandler.gift(client, event);
        if (cmd("/collection", text) || (cmdStart("/collection", text) && event.message.replyTo)) await shopHandler.inventory(client, event);

        // ── Solo Casino (works everywhere) ──
        if (cmdStart("/bj", text)) { if (await isAlive(event)) await blackjack.startBJ(client, event); }
        if (cmd("/slots", text)) await inlineGames.startSlots(client, event);
        if (cmd("/mines", text)) await inlineGames.startMines(client, event);
        if (cmd("/coin", text)) await inlineGames.startFlip(client, event);
        if (cmd("/roulette", text)) await inlineGames.startRoulette(client, event);
        if (cmd("/hl", text)) await inlineGames.startHL(client, event);

        // ── Combat (groups only) ──
        if (cmdStart("/kill", text)) { if (requireGroup(event) && await isAlive(event)) await combat.kill(client, event); }
        if (cmdStart("/rob", text)) { if (requireGroup(event) && await isAlive(event)) await combat.rob(client, event); }
        if (cmd("/revive", text)) await combat.revive(client, event);

        // ── Multiplayer games (groups only) ──
        if (cmdStart("/chess", text)) { if (requireGroup(event) && await isAlive(event)) await strategy.startChess(client, event); }
        if (cmdStart("/checkers", text)) { if (requireGroup(event) && await isAlive(event)) await strategy.startCheckers(client, event); }
        if (cmdStart("/xox", text)) { if (requireGroup(event) && await isAlive(event)) await boardGames.startXOX(client, event); }
        if (cmdStart("/c4", text)) { if (requireGroup(event) && await isAlive(event)) await boardGames.startC4(client, event); }
        if (cmdStart("/dice", text)) { if (requireGroup(event) && await isAlive(event)) await games.startDice(client, event); }
        if (cmdStart("/cards", text) || cmdStart("/wcards", text)) { if (requireGroup(event) && await isAlive(event)) await webCards.startWebCards(client, event); }
        if (cmdStart("/omi", text)) { if (requireGroup(event) && await isAlive(event)) await omi.startOmi(client, event); }
        if (cmdStart("/carrom", text)) { if (requireGroup(event) && await isAlive(event)) await carrom.startCarrom(client, event); }
        if (cmdStart("/hack", text)) { if (requireGroup(event) && await isAlive(event)) await multiHack.initHack(client, event); }
        if (cmd("/join", text)) {
            if (isGroupChat(event.chatId)) {
                await multiHack.joinHack(client, event);
            }
        }
        if (cmdStart("/guess", text)) await multiHack.processGuess(client, event);
        if (cmd("/surrender", text)) await strategy.surrender(client, event);

    }, new NewMessage({}));

    // Callback queries
    client.addEventHandler(async (update) => {
        if (update instanceof Api.UpdateBotCallbackQuery) {
            const cbUserId = update.userId.toString();
            if (await isBlacklisted(cbUserId)) return;

            let handled = false;
            const cbData = update.data.toString();

            if (cbData.startsWith("omjn|")) {
                try { await omi.handleOmiCallback(client, update); } catch (e) { console.error('[CB] omi:', e.message); }
                handled = true;
            }
            if (cbData.startsWith("wcjn|")) {
                try { await webCards.handleWebCardsCallback(client, update); } catch (e) { console.error('[CB] wcards:', e.message); }
                handled = true;
            }
            if (cbData.startsWith("crmjn|") || cbData.startsWith("crmst|")) {
                try { await carrom.handleCarromCallback(client, update); } catch (e) { console.error('[CB] carrom:', e.message); }
                handled = true;
            }
            if (cbData.startsWith("cs|") || cbData.startsWith("ck|") || cbData.startsWith("csjn|") || cbData.startsWith("ckjn|") || cbData.startsWith("cssr|") || cbData.startsWith("cksr|")) {
                try { await strategy.handleStrategyCallback(client, update); } catch (e) { console.error('[CB] strategy:', e.message); }
                handled = true;
            }
            if (!handled) {
                try { await games.handleCallback(client, update); } catch (e) { console.error('[CB] games:', e.message); }
                try { await games.handleDiceCallback(client, update); } catch (e) { console.error('[CB] dice:', e.message); }
                try { await inlineHandler.handleInlineCallback(client, update); } catch (e) { console.error('[CB] inline:', e.message); }
                try { await boardHandler.handleBoardCallback(client, update); } catch (e) { console.error('[CB] board:', e.message); }
                try { await blackjack.handleBJCallback(client, update); } catch (e) { console.error('[CB] bj:', e.message); }
                try { await client.invoke(new Api.messages.SetBotCallbackAnswer({ queryId: update.queryId, cacheTime: 1 })); } catch (e) {}
            }
        }
    });
})();
