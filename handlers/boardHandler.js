const { Api } = require("telegram");
const User = require('../models/User');
const sessions = require('../games/sessions');
const leveling = require('../utils/leveling');
const { editMsg } = require('../utils/editMsg');
const { getName } = require('../utils/getName');

function buildGrid(gameId, game, prefix) {
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

function boardText(game, type) {
    const pot = game.bet * 2;
    const p1 = game.getName(game.players[0]);
    const p2 = game.getName(game.players[1]);
    const turnName = game.getName(game.players[game.turn]);
    if (type === 'xox') {
        return `❌⭕ <b>TIC-TAC-TOE (8×8)</b> | Pot: $${pot}\n${p1} (❌) vs ${p2} (⭕)\n\n▶️ ${turnName}'s turn — get 4 in a row!`;
    } else {
        return `🔴🟡 <b>CONNECT FOUR (8×8)</b> | Pot: $${pot}\n${p1} (🔴) vs ${p2} (🟡)\n\n▶️ ${turnName}'s turn — pieces drop down!`;
    }
}

async function alertUser(client, queryId, text) {
    try {
        await client.invoke(new Api.messages.SetBotCallbackAnswer({ queryId, message: text, alert: true, cacheTime: 1 }));
    } catch (e) {}
}

async function ack(client, queryId) {
    try {
        await client.invoke(new Api.messages.SetBotCallbackAnswer({ queryId, cacheTime: 1 }));
    } catch (e) {}
}

const handleBoardCallback = async (client, update) => {
    const data = update.data.toString();
    const userId = update.userId.toString();

    // ── XOX Join ──
    if (data.startsWith("xjoin|")) {
        const gameId = data.replace("xjoin|", "");
        const g = sessions.get(gameId);
        if (!g || g.status !== 'lobby' || g.players.includes(userId)) return await ack(client, update.queryId);
        let user = await User.findOne({ userId }) || await User.create({ userId });
        if (user.wallet < g.bet) { await alertUser(client, update.queryId, "Insufficient funds!"); return; }
        if (g._lobbyTimer) { clearTimeout(g._lobbyTimer); g._lobbyTimer = null; }
        g.addPlayer(userId);
        for (const pid of g.players) g.setName(pid, await getName(client, pid));
        for (const pid of g.players) {
            let u = await User.findOne({ userId: pid }) || await User.create({ userId: pid });
            u.wallet -= g.bet; await u.save();
        }
        await editMsg(client, update.peer, update.msgId, boardText(g, 'xox'), buildGrid(gameId, g, 'xm'));
        await ack(client, update.queryId);
        return;
    }

    // ── C4 Join ──
    if (data.startsWith("cjoin|")) {
        const gameId = data.replace("cjoin|", "");
        const g = sessions.get(gameId);
        if (!g || g.status !== 'lobby' || g.players.includes(userId)) return await ack(client, update.queryId);
        let user = await User.findOne({ userId }) || await User.create({ userId });
        if (user.wallet < g.bet) { await alertUser(client, update.queryId, "Insufficient funds!"); return; }
        if (g._lobbyTimer) { clearTimeout(g._lobbyTimer); g._lobbyTimer = null; }
        g.addPlayer(userId);
        for (const pid of g.players) g.setName(pid, await getName(client, pid));
        for (const pid of g.players) {
            let u = await User.findOne({ userId: pid }) || await User.create({ userId: pid });
            u.wallet -= g.bet; await u.save();
        }
        await editMsg(client, update.peer, update.msgId, boardText(g, 'c4'), buildGrid(gameId, g, 'cm'));
        await ack(client, update.queryId);
        return;
    }

    // ── XOX Surrender ──
    if (data.startsWith("xmsr|")) {
        const gameId = data.split("|")[1];
        const game = sessions.get(gameId);
        if (!game || game.status !== 'playing' || !game.players.includes(userId)) return await ack(client, update.queryId);
        const winner = game.players.find(id => id !== userId);
        await handleEndGame(client, update.peer, update.msgId, game, winner, gameId, 'xox', true);
        await ack(client, update.queryId);
        return;
    }

    // ── C4 Surrender ──
    if (data.startsWith("cmsr|")) {
        const gameId = data.split("|")[1];
        const game = sessions.get(gameId);
        if (!game || game.status !== 'playing' || !game.players.includes(userId)) return await ack(client, update.queryId);
        const winner = game.players.find(id => id !== userId);
        await handleEndGame(client, update.peer, update.msgId, game, winner, gameId, 'c4', true);
        await ack(client, update.queryId);
        return;
    }

    // ── XOX Cell Click ──
    if (data.startsWith("xm|")) {
        const parts = data.split("|");
        const gameId = parts[1];
        const r = parseInt(parts[2]), c = parseInt(parts[3]);
        const game = sessions.get(gameId);
        if (!game || game.status !== 'playing') return await ack(client, update.queryId);
        if (!game.players.includes(userId)) { await ack(client, update.queryId); return; }
        if (game.players[game.turn] !== userId) { await alertUser(client, update.queryId, "Not your turn!"); return; }
        if (game.board[r][c] !== null) { await alertUser(client, update.queryId, "Cell already taken!"); return; }
        if (!game.makeMove(userId, r, c)) return;
        const winner = game.checkWinner();
        if (winner) { await handleEndGame(client, update.peer, update.msgId, game, winner, gameId, 'xox', false); await ack(client, update.queryId); return; }
        await editMsg(client, update.peer, update.msgId, boardText(game, 'xox'), buildGrid(gameId, game, 'xm'));
        await ack(client, update.queryId);
        return;
    }

    // ── C4 Cell Click — user taps any cell in column, piece drops to bottom ──
    if (data.startsWith("cm|")) {
        const parts = data.split("|");
        const gameId = parts[1];
        const col = parseInt(parts[3]); // use column only, ignore row
        const game = sessions.get(gameId);
        if (!game || game.status !== 'playing') return await ack(client, update.queryId);
        if (!game.players.includes(userId)) { await ack(client, update.queryId); return; }
        if (game.players[game.turn] !== userId) { await alertUser(client, update.queryId, "Not your turn!"); return; }
        if (!game.makeMove(userId, col)) { await alertUser(client, update.queryId, "Column is full!"); return; }
        const winner = game.checkWinner();
        if (winner) { await handleEndGame(client, update.peer, update.msgId, game, winner, gameId, 'c4', false); await ack(client, update.queryId); return; }
        await editMsg(client, update.peer, update.msgId, boardText(game, 'c4'), buildGrid(gameId, game, 'cm'));
        await ack(client, update.queryId);
        return;
    }
};

async function handleEndGame(client, peer, msgId, game, winner, gameId, type, isSurrender) {
    const pot = game.bet * 2;
    const p1 = game.getName(game.players[0]);
    const p2 = game.getName(game.players[1]);
    const typeLabel = type === 'xox' ? 'TIC-TAC-TOE' : 'CONNECT FOUR';
    const typeIcon = type === 'xox' ? '❌⭕' : '🔴🟡';
    let msg = "";

    if (winner === 'draw') {
        for (const pid of game.players) {
            let u = await User.findOne({ userId: pid }) || await User.create({ userId: pid });
            u.wallet += game.bet; await u.save();
        }
        msg = `${typeIcon} <b>${typeLabel} — DRAW!</b> 🤝\n${p1} vs ${p2}\n\nBets refunded.`;
    } else {
        const winnerName = game.getName(winner);
        let winUser = await User.findOne({ userId: winner }) || await User.create({ userId: winner });
        winUser.wallet += pot;
        const xpRes = await leveling.addXP(winner, 100);
        await winUser.save();
        const reason = isSurrender ? 'SURRENDER' : 'GAME OVER';
        msg = `${typeIcon} <b>${typeLabel} — ${reason}!</b>\n${p1} vs ${p2}\n\n🏆 <b>${winnerName}</b> wins <b>$${pot}</b>!`;
        if (xpRes.leveledUp) msg += `\n🆙 Level ${xpRes.level}!`;
    }
    await editMsg(client, peer, msgId, msg, null);
    sessions.delete(gameId);
}

module.exports = { handleBoardCallback };
