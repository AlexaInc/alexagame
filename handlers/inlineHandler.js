const { Api } = require("telegram");
const User = require('../models/User');
const sessions = require('../games/sessions');
const { buildGrid } = require('./inlineGames');

const handleInlineCallback = async (client, update) => {
    const data = update.data.toString();
    const userId = update.userId.toString();
    const parts = data.split("_");
    const gameType = parts[0];
    const action = parts[1];
    const gameId = parts[2];
    const val = parts[3];

    const session = sessions.get(gameId);
    if (!session) return;

    // --- MINES LOGIC ---
    if (gameType === 'mines' && action === 'click') {
        if (session.userId !== userId) return;
        const r = parseInt(parts[3]);
        const c = parseInt(parts[4]);

        if (session.grid[r][c] !== '⬜') return;

        const isMine = session.mines.some(m => m.r === r && m.c === c);
        if (isMine) {
            const user = await User.findOne({ userId });
            user.wallet -= session.bet;
            await user.save();
            await client.editMessage(update.peer, {
                id: update.msgId,
                message: "💥 **BOOM!** You hit a mine. Lost $100.",
                buttons: null
            });
            sessions.delete(gameId);
        } else {
            session.grid[r][c] = '💎';
            session.revealed++;
            if (session.revealed === 7) { // All safe spots found
                const user = await User.findOne({ userId });
                user.wallet += session.bet * 5;
                await user.save();
                await client.editMessage(update.peer, {
                    id: update.msgId,
                    message: "🏆 **CLEAR!** You found all safe spots. Won $500!",
                    buttons: null
                });
                sessions.delete(gameId);
            } else {
                await client.editMessage(update.peer, {
                    id: update.msgId,
                    message: `💎 Safe! Revealed: ${session.revealed}/7`,
                    buttons: client.buildReplyMarkup(buildGrid(gameId, session.grid, 'mines_click'))
                });
            }
    // --- ROULETTE LOGIC ---
    if (gameType === 'roulette' && action === 'pull') {
        const user = await User.findOne({ userId });
        const bet = 200;
        const isDeadly = Math.random() < (1/6);

        if (isDeadly) {
            user.wallet -= bet;
            user.isDead = true;
            user.lastDeath = new Date();
            user.health = 0;
            await client.editMessage(update.peer, {
                id: update.msgId,
                message: "💥 **BANG!** You shot yourself. You are DEAD.",
                buttons: null
            });
        } else {
            user.wallet += bet * 2;
            await client.editMessage(update.peer, {
                id: update.msgId,
                message: "🚩 **CLICK.** The chamber was empty. You won $400!",
                buttons: null
            });
        }
        await user.save();
        sessions.delete(gameId);
    }

    // --- HIGHER OR LOWER LOGIC ---
    if (gameType === 'hl' && action === 'play') {
        if (session.userId !== userId) return;
        const choice = parts[3];
        const nextNum = Math.floor(Math.random() * 13) + 1;
        const user = await User.findOne({ userId });

        const isHigher = nextNum > session.lastNum;
        const isWin = (choice === 'higher' && isHigher) || (choice === 'lower' && !isHigher && nextNum !== session.lastNum);

        if (nextNum === session.lastNum) {
             await client.editMessage(update.peer, {
                id: update.msgId,
                message: `🔄 The number was the same (**${nextNum}**)! Try again.`,
                buttons: update.message.replyMarkup
            });
            return;
        }

        if (isWin) {
            session.streak++;
            session.lastNum = nextNum;
            if (session.streak >= 3) {
                user.wallet += session.bet * 3;
                await user.save();
                await client.editMessage(update.peer, {
                    id: update.msgId,
                    message: `🏆 **STREAK!** The number was **${nextNum}**. You won $300!`,
                    buttons: null
                });
                sessions.delete(gameId);
            } else {
                await client.editMessage(update.peer, {
                    id: update.msgId,
                    message: `✅ Correct! It was **${nextNum}**. One more correct guess to win!\nNext number Higher or Lower than **${nextNum}**?`,
                    buttons: update.message.replyMarkup
                });
            }
        } else {
            user.wallet -= session.bet;
            await user.save();
            await client.editMessage(update.peer, {
                id: update.msgId,
                message: `❌ Wrong! The number was **${nextNum}**. You lost $100.`,
                buttons: null
            });
            sessions.delete(gameId);
        }
    }
}

    // --- FLIP LOGIC ---
    if (gameType === 'flip' && action === 'play') {
        const side = parts[3];
        const result = Math.random() > 0.5 ? 'heads' : 'tails';
        const user = await User.findOne({ userId });
        const bet = 100;

        if (side === result) {
            user.wallet += bet;
            await client.editMessage(update.peer, {
                id: update.msgId,
                message: `🪙 Result: **${result.toUpperCase()}**\n✅ You won $${bet}!`,
                buttons: null
            });
        } else {
            user.wallet -= bet;
            await client.editMessage(update.peer, {
                id: update.msgId,
                message: `🪙 Result: **${result.toUpperCase()}**\n❌ You lost $${bet}!`,
                buttons: null
            });
        }
        await user.save();
        sessions.delete(gameId);
    }

    // --- RPS LOGIC ---
    if (gameType === 'rps' && action === 'move') {
        const move = parts[3];
        if (session.moves[userId]) return; // Already moved

        session.moves[userId] = move;
        const players = Object.keys(session.moves);

        if (players.length === 2) {
            const p1 = players[0];
            const p2 = players[1];
            const m1 = session.moves[p1];
            const m2 = session.moves[p2];

            let winner = null;
            if (m1 === m2) winner = 'draw';
            else if ((m1 === 'rock' && m2 === 'scissors') || 
                     (m1 === 'paper' && m2 === 'rock') || 
                     (m1 === 'scissors' && m2 === 'paper')) winner = p1;
            else winner = p2;

            let msg = `✊✌️✋ **RPS RESULT**\n\nPlayer 1: ${m1}\nPlayer 2: ${m2}\n\n`;
            if (winner === 'draw') msg += "🤝 It's a DRAW!";
            else {
                const w = await User.findOne({ userId: winner });
                const loser = winner === p1 ? p2 : p1;
                const l = await User.findOne({ userId: loser });
                w.wallet += session.bet;
                l.wallet -= session.bet;
                await w.save();
                await l.save();
                msg += `🏆 Winner: [${winner}](tg://user?id=${winner})! Won $${session.bet}`;
            }

            await client.editMessage(update.peer, {
                id: update.msgId,
                message: msg,
                buttons: null
            });
            sessions.delete(gameId);
        }
    }
};

module.exports = { handleInlineCallback };
