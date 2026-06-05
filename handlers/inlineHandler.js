const { Api } = require("telegram");
const User = require('../models/User');
const sessions = require('../games/sessions');
const { buildMinesGrid } = require('./inlineGames');
const { editMsg } = require('../utils/editMsg');
const leveling = require('../utils/leveling');

const handleInlineCallback = async (client, update) => {
    const data = update.data.toString();
    const userId = update.userId.toString();
    const parts = data.split("|");
    const gameType = parts[0];
    const gameId = parts[1];

    // --- MINES ---
    if (gameType === 'mines') {
        const session = sessions.get(gameId);
        if (!session || session.type !== 'mines' || session.userId !== userId) return;
        const r = parseInt(parts[2]), c = parseInt(parts[3]);
        if (isNaN(r) || isNaN(c) || session.grid[r][c] !== '⬜') return;

        const isMine = session.mines.some(m => m.r === r && m.c === c);
        if (isMine) {
            let user = await User.findOne({ userId });
            if (!user) user = await User.create({ userId });
            user.wallet -= session.bet; await user.save();
            await editMsg(client, update.peer, update.msgId, `💥 <b>BOOM!</b> You hit a mine. Lost $${session.bet}.`, null);
            sessions.delete(gameId);
        } else {
            session.grid[r][c] = '💎';
            session.revealed++;
            if (session.revealed === 7) {
                let user = await User.findOne({ userId });
                if (!user) user = await User.create({ userId });
                const prize = session.bet * 5;
                user.wallet += prize; await user.save();
                await editMsg(client, update.peer, update.msgId, `🏆 <b>CLEAR!</b> All safe spots found. Won $${prize}!`, null);
                sessions.delete(gameId);
            } else {
                await editMsg(client, update.peer, update.msgId, `💎 Safe! Revealed: ${session.revealed}/7`, buildMinesGrid(gameId, session.grid));
            }
        }
        return;
    }

    // --- ROULETTE ---
    if (gameType === 'roulette') {
        let user = await User.findOne({ userId });
        if (!user) user = await User.create({ userId });
        const bet = 200;
        if (Math.random() < 1/6) {
            user.wallet -= bet; user.isDead = true; user.lastDeath = new Date(); user.health = 0;
            await user.save();
            await editMsg(client, update.peer, update.msgId, `💥 <b>BANG!</b> You are DEAD. Lost $${bet}.`, null);
        } else {
            user.wallet += bet * 2; await user.save();
            await editMsg(client, update.peer, update.msgId, `🚩 <b>CLICK.</b> Empty chamber. Won $${bet * 2}!`, null);
        }
        return;
    }

    // --- HIGHER OR LOWER ---
    if (gameType === 'hl') {
        const session = sessions.get(gameId);
        if (!session || session.type !== 'hl' || session.userId !== userId) return;
        const choice = parts[2];
        const nextNum = Math.floor(Math.random() * 13) + 1;
        let user = await User.findOne({ userId });
        if (!user) user = await User.create({ userId });

        if (nextNum === session.lastNum) {
            await editMsg(client, update.peer, update.msgId, `🔄 Same number (<b>${nextNum}</b>)! Try again.`, [
                [new Api.KeyboardButtonCallback({ text: "Higher ⬆️", data: Buffer.from(`hl|${gameId}|higher`) }),
                 new Api.KeyboardButtonCallback({ text: "Lower ⬇️", data: Buffer.from(`hl|${gameId}|lower`) })]
            ]);
            return;
        }
        const isWin = (choice === 'higher' && nextNum > session.lastNum) || (choice === 'lower' && nextNum < session.lastNum);
        if (isWin) {
            session.streak++; session.lastNum = nextNum;
            if (session.streak >= 3) {
                const prize = session.bet * 3;
                user.wallet += prize; await user.save();
                await editMsg(client, update.peer, update.msgId, `🏆 <b>STREAK x3!</b> Number was <b>${nextNum}</b>. Won $${prize}!`, null);
                sessions.delete(gameId);
            } else {
                await editMsg(client, update.peer, update.msgId, `✅ Correct! Was <b>${nextNum}</b>. Streak: ${session.streak}/3\nHigher or Lower than <b>${nextNum}</b>?`, [
                    [new Api.KeyboardButtonCallback({ text: "Higher ⬆️", data: Buffer.from(`hl|${gameId}|higher`) }),
                     new Api.KeyboardButtonCallback({ text: "Lower ⬇️", data: Buffer.from(`hl|${gameId}|lower`) })]
                ]);
            }
        } else {
            user.wallet -= session.bet; await user.save();
            await editMsg(client, update.peer, update.msgId, `❌ Wrong! Was <b>${nextNum}</b>. Lost $${session.bet}.`, null);
            sessions.delete(gameId);
        }
        return;
    }

    // --- FLIP ---
    if (gameType === 'flip') {
        const side = parts[2];
        const result = Math.random() > 0.5 ? 'heads' : 'tails';
        let user = await User.findOne({ userId });
        if (!user) user = await User.create({ userId });
        const bet = 100;
        if (side === result) {
            user.wallet += bet; await user.save();
            await editMsg(client, update.peer, update.msgId, `🪙 <b>${result.toUpperCase()}</b> ✅ You won $${bet}!`, null);
        } else {
            user.wallet -= bet; await user.save();
            await editMsg(client, update.peer, update.msgId, `🪙 <b>${result.toUpperCase()}</b> ❌ You lost $${bet}!`, null);
        }
        return;
    }

    // --- RPS ---
    if (gameType === 'rps') {
        const session = sessions.get(gameId);
        if (!session || session.type !== 'rps') return;
        const move = parts[2];
        if (session.moves[userId]) return;
        session.moves[userId] = move;
        const players = Object.keys(session.moves);
        if (players.length === 2) {
            const [p1, p2] = players;
            const m1 = session.moves[p1], m2 = session.moves[p2];
            let winner = null;
            if (m1 === m2) winner = 'draw';
            else if ((m1==='rock'&&m2==='scissors')||(m1==='paper'&&m2==='rock')||(m1==='scissors'&&m2==='paper')) winner = p1;
            else winner = p2;

            const pot = session.bet * 2;
            // Charge both
            let u1 = await User.findOne({ userId: p1 }) || await User.create({ userId: p1 });
            let u2 = await User.findOne({ userId: p2 }) || await User.create({ userId: p2 });
            u1.wallet -= session.bet; u2.wallet -= session.bet;

            let msg = `✊✌️✋ <b>RPS RESULT</b>\n\nP1: ${m1} vs P2: ${m2}\n\n`;
            if (winner === 'draw') {
                u1.wallet += session.bet; u2.wallet += session.bet;
                msg += "🤝 DRAW! Bets refunded.";
            } else {
                const wUser = winner === p1 ? u1 : u2;
                wUser.wallet += pot;
                msg += `🏆 Winner gets <b>$${pot}</b>!`;
            }
            await u1.save(); await u2.save();
            await editMsg(client, update.peer, update.msgId, msg, null);
            sessions.delete(gameId);
        }
        return;
    }
};

module.exports = { handleInlineCallback };
