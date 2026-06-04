const { Api } = require("telegram");
const User = require('../models/User');
const sessions = require('../games/sessions');

const handleBoardCallback = async (client, update) => {
    const data = update.data.toString();
    const userId = update.userId.toString();
    const parts = data.split("_");
    const gameType = parts[0]; // xox or c4
    const action = parts[1];
    const gameId = parts.slice(2).join("_");

    const game = sessions.get(gameId);
    if (!game && action !== "join") return;

    // --- JOIN LOGIC ---
    if (action === 'join') {
        const id = data.replace(`${gameType}_join_`, "");
        const g = sessions.get(id);
        if (!g || g.status !== 'lobby' || g.players.includes(userId)) return;

        const user = await User.findOne({ userId });
        if (user.wallet < g.bet) return;

        g.addPlayer(userId);
        await updateBoard(client, update.peer, update.msgId, g, id, gameType);
        return;
    }

    // --- MOVE LOGIC (XOX) ---
    if (gameType === 'xox' && action === 'move') {
        const index = parseInt(parts[2]);
        const actualGameId = parts.slice(3).join("_");
        const xoxGame = sessions.get(actualGameId);
        
        if (xoxGame && xoxGame.makeMove(userId, index)) {
            const winner = xoxGame.checkWinner();
            if (winner) {
                await handleEndGame(client, update.peer, update.msgId, xoxGame, winner, actualGameId);
            } else {
                await updateBoard(client, update.peer, update.msgId, xoxGame, actualGameId, 'xox');
            }
        }
    }

    // --- MOVE LOGIC (C4) ---
    if (gameType === 'c4' && action === 'move') {
        const col = parseInt(parts[2]);
        const actualGameId = parts.slice(3).join("_");
        const c4Game = sessions.get(actualGameId);

        if (c4Game && c4Game.makeMove(userId, col)) {
            const winner = c4Game.checkWinner();
            if (winner) {
                await handleEndGame(client, update.peer, update.msgId, c4Game, winner, actualGameId);
            } else {
                await updateBoard(client, update.peer, update.msgId, c4Game, actualGameId, 'c4');
            }
        }
    }
};

async function updateBoard(client, peer, msgId, game, gameId, type) {
    let buttons = [];
    let message = "";

    if (type === 'xox') {
        message = `❌⭕ **TIC-TAC-TOE**\nBet: $${game.bet}\n\nTurn: [${game.players[game.turn]}](tg://user?id=${game.players[game.turn]})`;
        for (let i = 0; i < 3; i++) {
            let row = [];
            for (let j = 0; j < 3; j++) {
                const idx = i * 3 + j;
                row.push(Api.KeyboardButtonCallback({ text: game.board[idx] || '⬜', data: `xox_move_${idx}_${gameId}` }));
            }
            buttons.push(row);
        }
    } else if (type === 'c4') {
        message = `🔴🟡 **CONNECT FOUR**\nBet: $${game.bet}\n\nTurn: [${game.players[game.turn]}](tg://user?id=${game.players[game.turn]})\n`;
        // Board display as text since buttons are limited
        let boardText = "";
        for (let r = 0; r < game.rows; r++) {
            boardText += game.board[r].map(cell => cell || '⚪').join("") + "\n";
        }
        message += "\n" + boardText;
        
        let row = [];
        for (let c = 0; c < game.cols; c++) {
            row.push(Api.KeyboardButtonCallback({ text: `${c+1}`, data: `c4_move_${c}_${gameId}` }));
        }
        buttons.push(row);
    }

    await client.editMessage(peer, {
        id: msgId,
        message: message,
        buttons: client.buildReplyMarkup(buttons)
    });
}

const leveling = require('../utils/leveling');

async function handleEndGame(client, peer, msgId, game, winner, gameId) {
    let msg = "";
    if (winner === 'draw') {
        msg = "🤝 **DRAW!** Money returned.";
    } else {
        const winUser = await User.findOne({ userId: winner });
        const loserId = game.players.find(id => id !== winner);
        const loseUser = await User.findOne({ userId: loserId });

        winUser.wallet += game.bet;
        loseUser.wallet -= game.bet;
        
        const xpRes = await leveling.addXP(winner, 100);
        msg = `🏆 **WINNER!**\n\nPlayer: [${winner}](tg://user?id=${winner})\nPrize: $${game.bet}`;
        if (xpRes.leveledUp) msg += `\n🆙 Leveled up to ${xpRes.level}!`;

        await winUser.save();
        await loseUser.save();
    }

    await client.editMessage(peer, {
        id: msgId,
        message: msg,
        buttons: null
    });
    sessions.delete(gameId);
}

module.exports = { handleBoardCallback };
