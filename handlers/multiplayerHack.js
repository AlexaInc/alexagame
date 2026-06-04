const { Api } = require("telegram");
const User = require('../models/User');
const MultiHack = require('../games/MultiHack');
const sessions = require('../games/sessions');

// Logic for Multiplayer Hack
const initHack = async (client, event) => {
    const parts = event.message.message.split(" ");
    const minBet = parseInt(parts[1]) || 100;
    const length = parseInt(parts[2]) || 4;
    const userId = event.senderId.toString();

    const user = await User.findOne({ userId });
    if (user.wallet < minBet) return event.reply({ message: "Insufficient funds for min bet!" });

    const chatId = event.chatId.toString();
    const gameKey = `multihack_${chatId}`;

    if (sessions.get(gameKey)) {
        return event.reply({ message: "A game is already pending or running in this chat!" });
    }

    const game = new MultiHack(userId, minBet, length);
    sessions.set(gameKey, game);

    await event.reply({ 
        message: `🔓 **Multiplayer Hack Lobby Started!**\n\nMin Bet: $${minBet}\nPin Length: ${length}\n\nUse /join to participate. Game starts in 60 seconds!` 
    });

    // Start Timer
    game.timer = setTimeout(() => startGame(client, chatId), 60000);
};

const joinHack = async (client, event) => {
    const chatId = event.chatId.toString();
    const userId = event.senderId.toString();
    const game = sessions.get(`multihack_${chatId}`);

    if (!game || game.status !== 'lobby') {
        return event.reply({ message: "No active lobby to join!" });
    }

    const user = await User.findOne({ userId });
    if (user.wallet < game.minBet) {
        return event.reply({ message: `You need at least $${game.minBet} to join!` });
    }

    if (game.addPlayer(userId)) {
        await event.reply({ message: `✅ Joined! Total players: ${game.players.length}` });
    } else {
        await event.reply({ message: "You are already in the lobby!" });
    }
};

const startGame = async (client, chatId) => {
    const game = sessions.get(`multihack_${chatId}`);
    if (!game) return;

    if (game.players.length < 1) { // Normally 2, but 1 for testing if needed
        sessions.delete(`multihack_${chatId}`);
        return client.sendMessage(chatId, { message: "Not enough players. Hack cancelled." });
    }

    game.status = 'playing';
    const currentPlayer = game.getCurrentPlayer();
    
    await client.sendMessage(chatId, { 
        message: `🚀 **HACK STARTED!**\n\nPlayers: ${game.players.length}\nPot: $${game.minBet * game.players.length}\n\nIt is now user [${currentPlayer}](tg://user?id=${currentPlayer})'s turn!\nUse \`/guess <pin>\`` 
    });
};

const processGuess = async (client, event) => {
    const text = event.message.message;
    if (!text.startsWith("/guess")) return;

    const chatId = event.chatId.toString();
    const userId = event.senderId.toString();
    const game = sessions.get(`multihack_${chatId}`);

    if (!game || game.status !== 'playing') return;

    if (game.getCurrentPlayer() !== userId) {
        return event.reply({ message: "Wait for your turn!" });
    }

    const guess = text.split(" ")[1];
    if (!guess || guess.length !== game.length || isNaN(guess)) {
        return event.reply({ message: `Please provide a ${game.length}-digit PIN.` });
    }

    const result = game.checkGuess(guess);
    if (result.bulls === game.length) {
const leveling = require('../utils/leveling');

// ... inside processGuess (Winner section) ...
        const prize = game.minBet * game.players.length;
        let msg = `🎯 **HACK SUCCESSFUL!**\n\nWinner: [${userId}](tg://user?id=${userId})\nPIN was: ${game.target}\nPrize: $${prize}\n`;
        
        for (const pid of game.players) {
            const p = await User.findOne({ userId: pid });
            if (pid === userId) {
                p.wallet += (prize - game.minBet);
                const xpRes = await leveling.addXP(pid, 150);
                if (xpRes.leveledUp) msg += `\n🆙 [${pid}](tg://user?id=${pid}) leveled up to ${xpRes.level}!`;
            } else {
                p.wallet -= game.minBet;
            }
            await p.save();
        }

        await client.sendMessage(chatId, { message: msg });
        sessions.delete(`multihack_${chatId}`);
    } else {
        game.nextTurn();
        const nextPlayer = game.getCurrentPlayer();
        await event.reply({ 
            message: `🔍 Result for ${guess}:\nBulls: ${result.bulls}\nCows: ${result.cows}\n\nNext turn: [${nextPlayer}](tg://user?id=${nextPlayer})` 
        });
    }
};

module.exports = { initHack, joinHack, processGuess };
