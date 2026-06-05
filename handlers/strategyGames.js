const { Api } = require("telegram");
const crypto = require('crypto');
const User = require('../models/User');
const Chess = require('../games/Chess');
const Checkers = require('../games/Checkers');
const sessions = require('../games/sessions');
const leveling = require('../utils/leveling');
const { editMsg } = require('../utils/editMsg');
const { getName } = require('../utils/getName');

// ── Generate unique game key: type + groupId + random hex ──
function genKey(type, chatId) {
    const rand = crypto.randomBytes(4).toString('hex');
    return `${type}:${chatId}:${rand}`;
}

// ── Check if user is already in any active strategy game in this chat ──
function userInGame(userId) {
    for (const [key, game] of sessions.all()) {
        if (!key.startsWith('cs:') && !key.startsWith('ck:')) continue;
        if (game.status !== 'lobby' && game.status !== 'playing') continue;
        if (game.players && game.players.includes(userId)) return key;
    }
    return null;
}

function buildBoard(gameId, game, prefix) {
    const rows = [];
    for (let r = 0; r < 8; r++) {
        const row = [];
        for (let c = 0; c < 8; c++) {
            row.push(new Api.KeyboardButtonCallback({
                text: game.cellEmoji(r, c),
                data: Buffer.from(`${prefix}|${gameId}|${r}|${c}`)
            }));
        }
        rows.push(row);
    }
    rows.push([
        new Api.KeyboardButtonCallback({ text: "Surrender", data: Buffer.from(`${prefix}sr|${gameId}`) })
    ]);
    return rows;
}

function boardText(game, type, names) {
    const title = type === 'chess' ? 'Chess' : 'Checkers';
    const wIcon = type === 'chess' ? '♙' : '⚪';
    const bIcon = type === 'chess' ? '♟' : '⚫';
    const pot = game.bet * 2;
    let txt = `<b>${title}</b> | Pot: $${pot}\n`;
    txt += `${names[0]} (${wIcon}) vs. ${names[1]} (${bIcon})\n\n`;
    const turnName = game.turn === 0 ? names[0] : names[1];
    const turnIcon = game.turn === 0 ? wIcon : bIcon;
    txt += `▶️ ${turnName} (${turnIcon})`;
    if (game.selected) {
        const col = String.fromCharCode(97 + game.selected.c);
        const row = 8 - game.selected.r;
        txt += `\n\n<i>(Selected: ${col}${row})`;
        if (game.mustContinueFrom) {
            txt += `\n(Chain jump! You must continue capturing)</i>`;
        } else {
            txt += `\n(Make your move or select different piece)</i>`;
        }
    }
    return txt;
}

async function alertUser(client, queryId, text) {
    try {
        await client.invoke(new Api.messages.SetBotCallbackAnswer({
            queryId, message: text, alert: true, cacheTime: 1,
        }));
    } catch (e) {}
}

async function ack(client, queryId) {
    try {
        await client.invoke(new Api.messages.SetBotCallbackAnswer({ queryId, cacheTime: 1 }));
    } catch (e) {}
}

async function getNames(client, game) {
    const n0 = await getName(client, game.players[0]);
    const n1 = game.players.length > 1 ? await getName(client, game.players[1]) : '???';
    return [n0, n1];
}

async function chargePlayers(game) {
    for (const pid of game.players) {
        let u = await User.findOne({ userId: pid }) || await User.create({ userId: pid });
        u.wallet -= game.bet; await u.save();
    }
}

function gameType(key) { return key.startsWith('cs:') ? 'chess' : 'checkers'; }
function gamePrefix(key) { return key.startsWith('cs:') ? 'cs' : 'ck'; }

// ── /chess <bet> ──
const startChess = async (client, event) => {
    const bet = parseInt(event.message.message.split(" ")[1]) || 100;
    const userId = event.message.senderId.toString();
    let user = await User.findOne({ userId }) || await User.create({ userId });
    if (user.wallet < bet) return event.message.respond({ message: "Insufficient funds!" });

    const existing = userInGame(userId);
    if (existing) return event.message.respond({ message: "You're already in an active game! Finish or surrender first." });

    const chatId = event.chatId.toString();
    const key = genKey('cs', chatId);
    const creatorName = await getName(client, userId);
    const game = new Chess(userId, bet);
    sessions.set(key, game);

    const sent = await client.sendMessage(event.chatId, {
        message: `<b>♔ CHESS ♚</b>\nBet: $${bet} each (Pot: $${bet*2})\n${creatorName} is waiting for opponent...`,
        buttons: client.buildReplyMarkup([[new Api.KeyboardButtonCallback({ text: "⚔️ Join Game", data: Buffer.from(`csjn|${key}`) })]])
    });

    // 60s lobby timeout
    game._lobbyTimer = setTimeout(async () => {
        const g = sessions.get(key);
        if (!g || g.status !== 'lobby') return;
        sessions.delete(key);
        try {
            await editMsg(client, event.chatId, sent.id, `<b>♔ CHESS ♚</b>\n⏳ Lobby expired. No opponent joined.\n${creatorName}'s bet was not charged.`, null);
        } catch (e) {}
    }, 60000);
};

// ── /checkers <bet> ──
const startCheckers = async (client, event) => {
    const bet = parseInt(event.message.message.split(" ")[1]) || 100;
    const userId = event.message.senderId.toString();
    let user = await User.findOne({ userId }) || await User.create({ userId });
    if (user.wallet < bet) return event.message.respond({ message: "Insufficient funds!" });

    const existing = userInGame(userId);
    if (existing) return event.message.respond({ message: "You're already in an active game! Finish or surrender first." });

    const chatId = event.chatId.toString();
    const key = genKey('ck', chatId);
    const creatorName = await getName(client, userId);
    const game = new Checkers(userId, bet);
    sessions.set(key, game);

    const sent = await client.sendMessage(event.chatId, {
        message: `<b>⚪ CHECKERS ⚫</b>\nBet: $${bet} each (Pot: $${bet*2})\n${creatorName} is waiting for opponent...`,
        buttons: client.buildReplyMarkup([[new Api.KeyboardButtonCallback({ text: "⚔️ Join Game", data: Buffer.from(`ckjn|${key}`) })]])
    });

    game._lobbyTimer = setTimeout(async () => {
        const g = sessions.get(key);
        if (!g || g.status !== 'lobby') return;
        sessions.delete(key);
        try {
            await editMsg(client, event.chatId, sent.id, `<b>⚪ CHECKERS ⚫</b>\n⏳ Lobby expired. No opponent joined.\n${creatorName}'s bet was not charged.`, null);
        } catch (e) {}
    }, 60000);
};

const joinStrategy = async () => {};

// ── Main callback handler ──
const handleStrategyCallback = async (client, update) => {
    const data = update.data.toString();
    const userId = update.userId.toString();

    // ── Join ──
    if (data.startsWith("csjn|") || data.startsWith("ckjn|")) {
        const key = data.split("|")[1];
        const game = sessions.get(key);
        if (!game || game.status !== 'lobby') return await ack(client, update.queryId);
        if (game.players.includes(userId)) { await alertUser(client, update.queryId, "You're already in!"); return; }

        // Check user not in another game
        const existing = userInGame(userId);
        if (existing) { await alertUser(client, update.queryId, "You're already in another game! Finish or surrender first."); return; }

        let user = await User.findOne({ userId }) || await User.create({ userId });
        if (user.wallet < game.bet) { await alertUser(client, update.queryId, "Insufficient funds!"); return; }
        // Cancel lobby timeout
        if (game._lobbyTimer) { clearTimeout(game._lobbyTimer); game._lobbyTimer = null; }
        game.addPlayer(userId);
        await chargePlayers(game);
        const type = gameType(key), prefix = gamePrefix(key);
        const names = await getNames(client, game);
        await editMsg(client, update.peer, update.msgId, boardText(game, type, names), buildBoard(key, game, prefix));
        await ack(client, update.queryId);
        return;
    }

    // ── Surrender ──
    if (data.startsWith("cssr|") || data.startsWith("cksr|")) {
        const gameId = data.split("|")[1];
        const game = sessions.get(gameId);
        if (!game || game.status !== 'playing') return await ack(client, update.queryId);
        if (!game.players.includes(userId)) return await ack(client, update.queryId);
        const type = gameType(gameId);
        const winner = game.players.find(id => id !== userId);
        await endGame(client, update.peer, update.msgId, game, winner, gameId, type, true);
        await ack(client, update.queryId);
        return;
    }

    // ── Board cells ──
    if (!data.startsWith("cs|") && !data.startsWith("ck|")) return;

    const parts = data.split("|");
    const prefix = parts[0];
    const gameId = parts[1];
    const r = parseInt(parts[2]);
    const c = parseInt(parts[3]);

    const game = sessions.get(gameId);
    if (!game || game.status !== 'playing') return await ack(client, update.queryId);
    const type = prefix === 'cs' ? 'chess' : 'checkers';

    if (!game.players.includes(userId)) { await ack(client, update.queryId); return; }

    const names = await getNames(client, game);

    // ── Piece selected ──
    if (game.selected) {
        if (game.players[game.turn] !== userId) { await alertUser(client, update.queryId, "Not your turn!"); return; }

        if (game.selected.r === r && game.selected.c === c) {
            const ok = game.deselect();
            if (!ok) { await alertUser(client, update.queryId, "You must continue jumping!"); return; }
            await editMsg(client, update.peer, update.msgId, boardText(game, type, names), buildBoard(gameId, game, prefix));
            await ack(client, update.queryId); return;
        }

        if (game.validMoves.some(m => m.r === r && m.c === c)) {
            const res = game.moveTo(r, c);
            if (res.error) { await alertUser(client, update.queryId, res.error); return; }
            const winner = game.checkWinner();
            if (winner) { await endGame(client, update.peer, update.msgId, game, winner, gameId, type, false); await ack(client, update.queryId); return; }
            await editMsg(client, update.peer, update.msgId, boardText(game, type, names), buildBoard(gameId, game, prefix));
            await ack(client, update.queryId); return;
        }

        if (game.isOwn(r, c)) {
            if (game.mustContinueFrom) { await alertUser(client, update.queryId, "You must continue jumping with the same piece!"); return; }
            game.deselect();
            const sel = game.selectPiece(userId, r, c);
            if (sel.error) { await alertUser(client, update.queryId, sel.error); return; }
            await editMsg(client, update.peer, update.msgId, boardText(game, type, names), buildBoard(gameId, game, prefix));
            await ack(client, update.queryId); return;
        }

        // Invalid taps — deselect and show alert
        if (game.isEnemy(r, c)) {
            game.deselect();
            await editMsg(client, update.peer, update.msgId, boardText(game, type, names), buildBoard(gameId, game, prefix));
            await alertUser(client, update.queryId, "Invalid selection! Piece deselected.");
            return;
        }
        game.deselect();
        await editMsg(client, update.peer, update.msgId, boardText(game, type, names), buildBoard(gameId, game, prefix));
        await alertUser(client, update.queryId, "Invalid move! Piece deselected.");
        return;
    }

    // ── No selection ──
    if (game.players[game.turn] !== userId) { await alertUser(client, update.queryId, "Not your turn!"); return; }
    if (!game.isOwn(r, c)) { await alertUser(client, update.queryId, "Invalid selection!"); return; }

    const sel = game.selectPiece(userId, r, c);
    if (sel.error) { await alertUser(client, update.queryId, sel.error); return; }

    await editMsg(client, update.peer, update.msgId, boardText(game, type, names), buildBoard(gameId, game, prefix));
    await ack(client, update.queryId);
};

async function endGame(client, peer, msgId, game, winner, gameId, type, isSurrender) {
    const title = type === 'chess' ? 'Chess' : 'Checkers';
    const pot = game.bet * 2;
    let msg = "";
    if (winner === 'draw') {
        for (const pid of game.players) {
            let u = await User.findOne({ userId: pid }) || await User.create({ userId: pid });
            u.wallet += game.bet; await u.save();
        }
        msg = `<b>${title} — DRAW!</b> 🤝\nBets refunded.`;
    } else {
        const wName = await getName(client, winner);
        let w = await User.findOne({ userId: winner }) || await User.create({ userId: winner });
        w.wallet += pot;
        const xp = await leveling.addXP(winner, 200);
        await w.save();
        const reason = isSurrender ? 'SURRENDER' : 'GAME OVER';
        msg = `🏆 <b>${title} — ${reason}!</b>\n\n${wName} wins <b>$${pot}</b> + 200 XP!`;
        if (xp.leveledUp) msg += `\n🆙 Level ${xp.level}!`;
    }
    await editMsg(client, peer, msgId, msg, null);
    sessions.delete(gameId);
}

const surrender = async (client, event) => {
    const chatId = event.chatId.toString();
    const userId = event.message.senderId.toString();
    const myGame = userInGame(userId);
    if (!myGame) return event.message.respond({ message: "You're not in any active game!" });
    const game = sessions.get(myGame);
    if (!game || game.status !== 'playing') return event.message.respond({ message: "No active game to surrender!" });
    const winner = game.players.find(id => id !== userId);
    const wName = await getName(client, winner);
    const pot = game.bet * 2;
    let w = await User.findOne({ userId: winner }) || await User.create({ userId: winner });
    w.wallet += pot;
    await leveling.addXP(winner, 100);
    await w.save();
    const type = myGame.startsWith('cs:') ? 'Chess' : 'Checkers';
    await event.message.respond({ message: `🏳️ <b>${type} — SURRENDER!</b> ${wName} wins <b>$${pot}</b>!` });
    sessions.delete(myGame);
};

module.exports = { startChess, startCheckers, joinStrategy, handleStrategyCallback, surrender };
