const { Api } = require("telegram");
const User = require('../models/User');
const MultiHack = require('../games/MultiHack');
const sessions = require('../games/sessions');
const leveling = require('../utils/leveling');
const { getName } = require('../utils/getName');

const initHack = async (client, event) => {
    const parts = event.message.message.split(" ");
    const minBet = parseInt(parts[1]) || 100;
    const length = parseInt(parts[2]) || 4;
    const userId = event.message.senderId.toString();

    let user = await User.findOne({ userId }) || await User.create({ userId });
    if (user.wallet < minBet) return event.message.respond({ message: "Insufficient funds for min bet!" });

    const chatId = event.chatId.toString();
    const gameKey = `multihack_${chatId}`;
    if (sessions.get(gameKey)) return event.message.respond({ message: "A game is already pending or running in this chat!" });

    const game = new MultiHack(userId, minBet, length);
    sessions.set(gameKey, game);

    await event.message.respond({
        message: `🔓 <b>Multiplayer Hack Lobby Started!</b>\n\nMin Bet: $${minBet}\nPin Length: ${length}\n\nUse /join to participate. Game starts in 60 seconds!`
    });

    game.timer = setTimeout(() => startGame(client, chatId), 60000);
};

const joinHack = async (client, event) => {
    const chatId = event.chatId.toString();
    const userId = event.message.senderId.toString();
    const game = sessions.get(`multihack_${chatId}`);
    if (!game || game.status !== 'lobby') return;

    let user = await User.findOne({ userId }) || await User.create({ userId });
    if (user.wallet < game.minBet) return event.message.respond({ message: `You need at least $${game.minBet} to join!` });

    if (game.addPlayer(userId)) {
        await event.message.respond({ message: `✅ Joined! Total players: ${game.players.length}` });
    } else {
        await event.message.respond({ message: "You are already in the lobby!" });
    }
};

const startGame = async (client, chatId) => {
    const game = sessions.get(`multihack_${chatId}`);
    if (!game) return;

    if (game.players.length < 1) {
        sessions.delete(`multihack_${chatId}`);
        return client.sendMessage(chatId, { message: "Not enough players. Hack cancelled." });
    }

    game.status = 'playing';
    const currentPlayer = game.getCurrentPlayer();
    const name = await getName(client, currentPlayer);

    await client.sendMessage(chatId, {
        message: `🚀 <b>HACK STARTED!</b>\n\nPlayers: ${game.players.length}\nPot: $${game.minBet * game.players.length}\n\nIt is now <a href="tg://user?id=${currentPlayer}">${name}</a>'s turn!\nUse <code>/guess &lt;pin&gt;</code>`
    });
};

const processGuess = async (client, event) => {
    const text = event.message.message;
    if (!text.startsWith("/guess")) return;

    const chatId = event.chatId.toString();
    const userId = event.message.senderId.toString();
    const game = sessions.get(`multihack_${chatId}`);
    if (!game || game.status !== 'playing') return;

    if (game.getCurrentPlayer() !== userId) return event.message.respond({ message: "Wait for your turn!" });

    const guess = text.split(" ")[1];
    if (!guess || guess.length !== game.length || isNaN(guess)) {
        return event.message.respond({ message: `Please provide a ${game.length}-digit PIN.` });
    }

    const result = game.checkGuess(guess);
    if (result.bulls === game.length) {
        const pot = game.minBet * game.players.length;
        const winnerName = await getName(client, userId);
        let msg = `🎯 <b>HACK SUCCESSFUL!</b>\n\nPIN was: ${game.target}\nPot: <b>$${pot}</b>\n`;

        for (const pid of game.players) {
            let p = await User.findOne({ userId: pid }) || await User.create({ userId: pid });
            if (pid === userId) {
                p.wallet += (pot - game.minBet);
                const xpRes = await leveling.addXP(pid, 150);
                const pName = await getName(client, pid);
                if (xpRes.leveledUp) msg += `\n🆙 ${pName} leveled up to ${xpRes.level}!`;
            } else {
                p.wallet -= game.minBet;
            }
            await p.save();
        }

        msg += `\n🏆 <b>${winnerName}</b> wins!`;
        await client.sendMessage(chatId, { message: msg });
        sessions.delete(`multihack_${chatId}`);
    } else {
        game.nextTurn();
        const nextPlayer = game.getCurrentPlayer();
        const nextName = await getName(client, nextPlayer);
        await event.message.respond({
            message: `🔍 Result for ${guess}:\nBulls: ${result.bulls}\nCows: ${result.cows}\n\nNext turn: <a href="tg://user?id=${nextPlayer}">${nextName}</a>`
        });
    }
};

module.exports = { initHack, joinHack, processGuess };
