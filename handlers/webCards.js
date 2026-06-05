const { Api } = require("telegram");
const crypto = require('crypto');
const User = require('../models/User');
const WebCardGame = require('../games/WebCardGame');
const sessions = require('../games/sessions');
const { getName } = require('../utils/getName');
const { getBotUsername } = require('../utils/miniAppButton');

function playUrl(gameId) {
    return `https://t.me/${getBotUsername()}?startapp=wcards_${gameId.replace(/:/g, '_0_')}`;
}

const startWebCards = async (client, event) => {
    const bet = Math.max(50, parseInt(event.message.message.split(" ")[1]) || 100);
    const userId = event.message.senderId.toString();
    let user = await User.findOne({ userId }) || await User.create({ userId });
    if (user.wallet < bet) return event.message.respond({ message: "Insufficient funds!" });

    const gameId = `wc:${event.chatId}:${crypto.randomBytes(4).toString('hex')}`;
    const name = await getName(client, userId);
    const game = new WebCardGame(bet);
    game.addPlayer(userId, name);
    game.chatId = event.chatId.toString();
    sessions.set(gameId, game);

    await client.sendMessage(event.chatId, {
        message: `🃏 <b>CARD GAME</b>\nBet: $${bet} each\n\n👤 ${name} (host)\n⏳ Waiting for players (2-6)...\n\n<i>Open the Mini App to see your cards!</i>`,
        buttons: new Api.ReplyInlineMarkup({ rows: [
            new Api.KeyboardButtonRow({ buttons: [
                new Api.KeyboardButtonCallback({ text: `⚔️ Join ($${bet})`, data: Buffer.from(`wcjn|${gameId}`) })
            ] }),
            new Api.KeyboardButtonRow({ buttons: [
                new Api.KeyboardButtonUrl({ text: "🃏 Open Game", url: playUrl(gameId) })
            ] })
        ] })
    });

    game._timer = setTimeout(async () => {
        const g = sessions.get(gameId);
        if (!g || g.status !== 'lobby') return;
        if (g.players.length >= 2) { g.start(); /* auto-start */ }
        else { sessions.delete(gameId); try { await client.sendMessage(event.chatId, { message: `🃏 Lobby expired.` }); } catch (e) {} }
    }, 120000);
};

const handleWebCardsCallback = async (client, update) => {
    const data = update.data.toString();
    const userId = update.userId.toString();

    if (data.startsWith("wcjn|")) {
        const gameId = data.split("|")[1];
        const game = sessions.get(gameId);
        if (!game || game.status !== 'lobby') { await alert(client, update, "Expired!"); return; }
        if (game.players.some(p => p.userId === userId)) { await alert(client, update, "Already in!"); return; }
        if (game.players.length >= 6) { await alert(client, update, "Full!"); return; }
        let user = await User.findOne({ userId }) || await User.create({ userId });
        if (user.wallet < game.bet) { await alert(client, update, "Insufficient funds!"); return; }
        game.addPlayer(userId, await getName(client, userId));

        if (game.players.length >= 2 && !game._autoStart) {
            game._autoStart = setTimeout(async () => {
                const g = sessions.get(gameId);
                if (g && g.status === 'lobby' && g.players.length >= 2) g.start();
            }, 60000);
        }

        const pl = game.players.map((p, i) => `👤 ${p.name}${i === 0 ? ' (host)' : ''}`).join('\n');
        try {
            await client.editMessage(update.peer, {
                message: update.msgId,
                text: `🃏 <b>CARD GAME</b>\nBet: $${game.bet} each\n\n${pl}\n\n✅ ${game.players.length} players — Host can start!`,
                parseMode: 'html',
                buttons: new Api.ReplyInlineMarkup({ rows: [
                    new Api.KeyboardButtonRow({ buttons: [
                        new Api.KeyboardButtonCallback({ text: `⚔️ Join ($${game.bet})`, data: Buffer.from(`wcjn|${gameId}`) })
                    ] }),
                    new Api.KeyboardButtonRow({ buttons: [
                        new Api.KeyboardButtonUrl({ text: "🃏 Open Game", url: playUrl(gameId) })
                    ] })
                ] })
            });
        } catch (e) {}
        await alert(client, update, "Joined!");
        return;
    }
    await ack(client, update);
};

async function alert(client, update, text) {
    try { await client.invoke(new Api.messages.SetBotCallbackAnswer({ queryId: update.queryId, message: text, alert: true, cacheTime: 1 })); } catch (e) {}
}
async function ack(client, update) {
    try { await client.invoke(new Api.messages.SetBotCallbackAnswer({ queryId: update.queryId, cacheTime: 1 })); } catch (e) {}
}

module.exports = { startWebCards, handleWebCardsCallback };
