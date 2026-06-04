const { Api } = require("telegram");
const User = require('../models/User');
const CardGame = require('../games/CardGame');
const sessions = require('../games/sessions');
const leveling = require('../utils/leveling');

const initCardGame = async (client, event) => {
    const bet = parseInt(event.message.message.split(" ")[1]) || 100;
    const userId = event.senderId.toString();
    const user = await User.findOne({ userId });

    if (user.wallet < bet) return event.reply({ message: "Insufficient funds!" });

    const chatId = event.chatId.toString();
    const gameKey = `cards_${chatId}`;

    if (sessions.get(gameKey)) return event.reply({ message: "A game is already pending in this chat!" });

    const game = new CardGame(userId, bet);
    sessions.set(gameKey, game);

    await event.reply({
        message: `🃏 **Card Game Lobby Started!**\nBet: $${bet}\n\nUse /join to participate. Game starts in 60 seconds!`
    });

    setTimeout(() => startGame(client, chatId), 60000);
};

const joinCardGame = async (client, event) => {
    const chatId = event.chatId.toString();
    const userId = event.senderId.toString();
    const game = sessions.get(`cards_${chatId}`);

    if (!game || game.status !== 'lobby') return;

    const user = await User.findOne({ userId });
    if (user.wallet < game.bet) return event.reply({ message: "Not enough money!" });

    if (game.addPlayer(userId)) {
        await event.reply({ message: `✅ Joined! Total players: ${game.players.length}` });
    }
};

const startGame = async (client, chatId) => {
    const game = sessions.get(`cards_${chatId}`);
    if (!game) return;

    if (game.players.length < 2) {
        client.sendMessage(chatId, { message: "Not enough players. Card game cancelled." });
        sessions.delete(`cards_${chatId}`);
        return;
    }

    // Shuffle players to change queue order every game
    game.players = game.players.sort(() => Math.random() - 0.5);
    game.setupGame();
    
    const currentPlayer = game.getCurrentPlayer();
    await client.sendMessage(chatId, {
        message: `🚀 **THE CARD GAME HAS BEGUN!**\n\nEvery player has 4 cards: **a, b, c, d**.\n\nIt is now [${currentPlayer}](tg://user?id=${currentPlayer})'s turn!\nUse \`/flip a\`, \`/flip b\`, etc. to reveal a card.`
    });
};

const processFlip = async (client, event) => {
    const text = event.message.message;
    if (!text.startsWith("/flip")) return;

    const chatId = event.chatId.toString();
    const userId = event.senderId.toString();
    const game = sessions.get(`cards_${chatId}`);

    if (!game || game.status !== 'playing') return;

    const cardName = text.split(" ")[1];
    const result = game.flipCard(userId, cardName);

    if (result.error) return event.reply({ message: result.error });

    let msg = `🎴 [${userId}](tg://user?id=${userId}) flipped card **${cardName}** and got: **${result.cardLabel}**\n\n`;
    
    msg += `**Round Progress:**\n`;
    result.history.forEach(h => {
        msg += `- User [${h.userId}](tg://user?id=${h.userId}): ${h.label}\n`;
    });

    if (result.roundFinished) {
        msg += `\n🏁 **Round ${game.round - 1} finished!**\n`;
        game.players.forEach(pid => {
            msg += `- [${pid}](tg://user?id=${pid}): ${game.playerData[pid].points} total points\n`;
        });

        if (game.status === 'finished') {
            const winners = game.getWinner();
            const pot = game.bet * game.players.length;
            const prize = Math.floor(pot / winners.length);

            msg += `\n🏆 **GAME OVER!**\nWinner(s): ${winners.map(w => `[${w}](tg://user?id=${w})`).join(", ")}\nPrize: $${prize} each!`;
            
            // Payout Logic
            for (const pid of game.players) {
                const u = await User.findOne({ userId: pid });
                if (winners.includes(pid)) {
                    u.wallet += (prize - game.bet);
                    const xpRes = await leveling.addXP(pid, 200);
                    if (xpRes.leveledUp) msg += `\n🆙 [${pid}](tg://user?id=${pid}) leveled up to ${xpRes.level}!`;
                } else {
                    u.wallet -= game.bet;
                }
                await u.save();
            }
            sessions.delete(`cards_${chatId}`);
        } else {
            const nextP = game.getCurrentPlayer();
            msg += `\n**Round ${game.round} Start!**\nNext turn: [${nextP}](tg://user?id=${nextP})`;
        }
    } else {
        const nextP = game.getCurrentPlayer();
        msg += `\nNext turn: [${nextP}](tg://user?id=${nextP})`;
    }

    await client.sendMessage(chatId, { message: msg });
};

module.exports = { initCardGame, joinCardGame, processFlip };
