const { Api } = require("telegram");
const crypto = require('crypto');
const User = require('../models/User');
const OmiGame = require('../games/OmiGame');
const sessions = require('../games/sessions');
const { getName } = require('../utils/getName');
const { getBotUsername } = require('../utils/miniAppButton');

function playUrl(gameId) {
    return `https://t.me/${getBotUsername()}?startapp=omi_${gameId.replace(/:/g, '_0_')}`;
}

const startOmi = async (client, event) => {
    const bet = Math.max(50, parseInt(event.message.message.split(" ")[1]) || 100);
    const userId = event.message.senderId.toString();
    let user = await User.findOne({ userId }) || await User.create({ userId });
    if (user.wallet < bet) return event.message.respond({ message: "Insufficient funds!" });

    const gameId = `omi:${event.chatId}:${crypto.randomBytes(4).toString('hex')}`;
    const name = await getName(client, userId);
    const game = new OmiGame(bet);
    game.addPlayer(userId, name);
    game.chatId = event.chatId.toString();
    sessions.set(gameId, game);

    await client.sendMessage(event.chatId, {
        message: `🃏 <b>OMI</b>\nBet: $${bet} each | 2-4 players\n\n👤 ${name} (host)\n⏳ Waiting...`,
        buttons: new Api.ReplyInlineMarkup({ rows: [
            new Api.KeyboardButtonRow({ buttons: [
                new Api.KeyboardButtonCallback({ text: `⚔️ Join ($${bet})`, data: Buffer.from(`omjn|${gameId}`) })
            ] }),
            new Api.KeyboardButtonRow({ buttons: [
                new Api.KeyboardButtonUrl({ text: "🃏 Open Game", url: playUrl(gameId) })
            ] })
        ] })
    });

    game._timer = setTimeout(async () => {
        const g = sessions.get(gameId);
        if (!g || g.status !== 'lobby') return;
        if (g.players.length >= 2) g.start();
        else { sessions.delete(gameId); try { await client.sendMessage(event.chatId, { message: `🃏 Omi lobby expired.` }); } catch {} }
    }, 120000);
};

const handleOmiCallback = async (client, update) => {
    const data = update.data.toString();
    const userId = update.userId.toString();
    if (!data.startsWith("omjn|")) return;

    const gameId = data.split("|")[1];
    const game = sessions.get(gameId);
    if (!game || game.status !== 'lobby') { await al(client, update, "Expired!"); return; }
    if (game.players.some(p => p.userId === userId)) { await al(client, update, "Already in!"); return; }
    if (game.players.length >= 4) { await al(client, update, "Full!"); return; }
    let user = await User.findOne({ userId }) || await User.create({ userId });
    if (user.wallet < game.bet) { await al(client, update, "No funds!"); return; }
    game.addPlayer(userId, await getName(client, userId));

    if (game.players.length >= 2 && !game._autoStart) {
        game._autoStart = setTimeout(async () => {
            const g = sessions.get(gameId); if (g?.status === 'lobby' && g.players.length >= 2) g.start();
        }, 60000);
    }

    const pl = game.players.map((p, i) => `👤 ${p.name}${i === 0 ? ' (host)' : ''}`).join('\n');
    try {
        await client.editMessage(update.peer, {
            message: update.msgId,
            text: `🃏 <b>OMI</b>\nBet: $${game.bet}\n\n${pl}\n\n✅ ${game.players.length} players`,
            parseMode: 'html',
            buttons: new Api.ReplyInlineMarkup({ rows: [
                new Api.KeyboardButtonRow({ buttons: [new Api.KeyboardButtonCallback({ text: `⚔️ Join`, data: Buffer.from(`omjn|${gameId}`) })] }),
                new Api.KeyboardButtonRow({ buttons: [new Api.KeyboardButtonUrl({ text: "🃏 Open", url: playUrl(gameId) })] })
            ] })
        });
    } catch {}
    await al(client, update, "Joined!");
};

async function al(c, u, t) { try { await c.invoke(new Api.messages.SetBotCallbackAnswer({ queryId: u.queryId, message: t, alert: true, cacheTime: 1 })); } catch {} }

module.exports = { startOmi, handleOmiCallback };
