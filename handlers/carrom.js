const { Api } = require("telegram");
const crypto = require('crypto');
const User = require('../models/User');
const CarromGame = require('../games/CarromGame');
const sessions = require('../games/sessions');
const leveling = require('../utils/leveling');
const { getName } = require('../utils/getName');
const { getBotUsername } = require('../utils/miniAppButton');

function playUrl(gameId) {
    return `https://t.me/${getBotUsername()}?startapp=carrom_${gameId.replace(/:/g, '_0_')}`;
}

function lobbyMsg(game) {
    const pl = game.players.map((p, i) => {
        let tag = i === 0 ? ' (host)' : '';
        return `👤 ${p.name}${tag}`;
    }).join('\n');
    let status = '';
    if (game.players.length < 2) status = '⏳ Need at least 1 more player';
    else if (game.players.length < 4) status = `✅ ${game.players.length} players — Host can start or wait for more (max 4)`;
    else status = '✅ 4 players — Ready!';
    return `🎯 <b>CARROM</b>\nBet: $${game.bet} each\n\n${pl}\n\n${status}`;
}

function lobbyButtons(game, gameId) {
    const rows = [];
    if (game.players.length < 4) {
        rows.push(new Api.KeyboardButtonRow({ buttons: [
            new Api.KeyboardButtonCallback({ text: `⚔️ Join ($${game.bet})`, data: Buffer.from(`crmjn|${gameId}`) })
        ] }));
    }
    rows.push(new Api.KeyboardButtonRow({ buttons: [
        new Api.KeyboardButtonUrl({ text: "🎮 Open Game", url: playUrl(gameId) })
    ] }));
    return new Api.ReplyInlineMarkup({ rows });
}

async function doStartGame(client, game, gameId) {
    if (game.status !== 'lobby') return;
    if (game.players.length < 2) return;

    // 3 players → kick last (carrom is 1v1 or 2v2, not 3)
    if (game.players.length === 3) {
        const kicked = game.players.pop(); game.scores.pop();
        try { await client.sendMessage(game.chatId, { message: `😔 Sorry <b>${kicked.name}</b>, carrom needs 2 or 4 players. You've been removed.` }); } catch (e) {}
    }

    if (game._timer) { clearTimeout(game._timer); game._timer = null; }
    if (game._autoStart) { clearTimeout(game._autoStart); game._autoStart = null; }

    // Charge all
    for (const p of game.players) {
        let u = await User.findOne({ userId: p.userId }) || await User.create({ userId: p.userId });
        u.wallet -= game.bet; await u.save();
    }

    game.start();
    const pot = game.bet * game.players.length;
    const n = game.players.length;
    let desc = '';
    if (n === 2) {
        desc = `⚫ ${game.players[0].name} vs ⚪ ${game.players[1].name}`;
    } else {
        desc = `⚫ Team Black: ${game.players[0].name} & ${game.players[2].name}\n⚪ Team White: ${game.players[1].name} & ${game.players[3].name}`;
    }

    await client.sendMessage(game.chatId, {
        message: `🎯 <b>CARROM — GAME ON!</b>\nPot: <b>$${pot}</b>\n\n${desc}\n\nPocket your color pieces to win!`,
        buttons: new Api.ReplyInlineMarkup({ rows: [
            new Api.KeyboardButtonRow({ buttons: [
                new Api.KeyboardButtonUrl({ text: "🎮 Play / Watch", url: playUrl(gameId) })
            ] })
        ] })
    });
}

const startCarrom = async (client, event) => {
    const bet = Math.max(100, parseInt(event.message.message.split(" ")[1]) || 100);
    const userId = event.message.senderId.toString();
    let user = await User.findOne({ userId }) || await User.create({ userId });
    if (user.wallet < bet) return event.message.respond({ message: "Insufficient funds! Min: $100" });

    const gameId = `crm:${event.chatId}:${crypto.randomBytes(4).toString('hex')}`;
    const name = await getName(client, userId);
    const game = new CarromGame(bet, 4); // always max 4
    game.addPlayer(userId, name);
    game.chatId = event.chatId.toString();
    sessions.set(gameId, game);

    await client.sendMessage(event.chatId, {
        message: lobbyMsg(game),
        buttons: lobbyButtons(game, gameId)
    });

    // 2 min lobby timeout
    game._timer = setTimeout(async () => {
        const g = sessions.get(gameId);
        if (!g || g.status !== 'lobby') return;
        if (g.players.length >= 2) {
            await doStartGame(client, g, gameId);
        } else {
            sessions.delete(gameId);
            try { await client.sendMessage(event.chatId, { message: `🎯 <b>CARROM</b> ⏳ Lobby expired.` }); } catch (e) {}
        }
    }, 120000);
};

const handleCarromCallback = async (client, update) => {
    const data = update.data.toString();
    const userId = update.userId.toString();

    if (data.startsWith("crmjn|")) {
        const gameId = data.split("|")[1];
        const game = sessions.get(gameId);
        if (!game || game.status !== 'lobby') { await alert(client, update, "Lobby expired!"); return; }
        if (game.players.some(p => p.userId === userId)) { await alert(client, update, "Already in!"); return; }
        if (game.players.length >= 4) { await alert(client, update, "Lobby full (4/4)!"); return; }
        let user = await User.findOne({ userId }) || await User.create({ userId });
        if (user.wallet < game.bet) { await alert(client, update, "Insufficient funds!"); return; }
        game.addPlayer(userId, await getName(client, userId));

        // 60s auto-start backup when 2+ players
        if (game.players.length >= 2 && !game._autoStart) {
            game._autoStart = setTimeout(async () => {
                const g = sessions.get(gameId);
                if (!g || g.status !== 'lobby' || g.players.length < 2) return;
                await doStartGame(client, g, gameId);
            }, 60000);
        }

        try {
            await client.editMessage(update.peer, {
                message: update.msgId, text: lobbyMsg(game),
                parseMode: 'html', buttons: lobbyButtons(game, gameId)
            });
        } catch (e) {}
        await alert(client, update, "Joined!");
        return;
    }

    if (data.startsWith("crmst|")) {
        const gameId = data.split("|")[1];
        const game = sessions.get(gameId);
        if (!game || game.status !== 'lobby') { await alert(client, update, "Expired!"); return; }
        if (game.hostId !== userId) { await alert(client, update, "Only host!"); return; }
        if (game.players.length < 2) { await alert(client, update, "Need 2+ players!"); return; }
        await doStartGame(client, game, gameId);
        await ack(client, update);
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

module.exports = { startCarrom, handleCarromCallback };
