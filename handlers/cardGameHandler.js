const { Api } = require("telegram");
const User = require('../models/User');
const CardGame = require('../games/CardGame');
const sessions = require('../games/sessions');
const leveling = require('../utils/leveling');
const { getName } = require('../utils/getName');

const initCardGame = async (client, event) => {
    const bet = parseInt(event.message.message.split(" ")[1]) || 100;
    const userId = event.message.senderId.toString();
    let user = await User.findOne({ userId }) || await User.create({ userId });
    if (user.wallet < bet) return event.message.respond({ message: "Insufficient funds!" });

    const chatId = event.chatId.toString();
    const gameKey = `cards_${chatId}`;
    if (sessions.get(gameKey)) return event.message.respond({ message: "A game is already pending in this chat!" });

    const game = new CardGame(userId, bet);
    sessions.set(gameKey, game);

    await event.message.respond({
        message: `🃏 <b>Card Game Lobby Started!</b>\nBet: $${bet}\n\nUse /join to participate. Game starts in 60 seconds!`
    });

    setTimeout(() => startGame(client, chatId), 60000);
};

const joinCardGame = async (client, event) => {
    const chatId = event.chatId.toString();
    const userId = event.message.senderId.toString();
    const game = sessions.get(`cards_${chatId}`);
    if (!game || game.status !== 'lobby') return;

    let user = await User.findOne({ userId }) || await User.create({ userId });
    if (user.wallet < game.bet) return event.message.respond({ message: "Not enough money!" });

    if (game.addPlayer(userId)) {
        await event.message.respond({ message: `✅ Joined! Total players: ${game.players.length}` });
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

    game.players = game.players.sort(() => Math.random() - 0.5);
    game.setupGame();

    // Send each player their cards via DM (private message)
    for (const pid of game.players) {
        const pName = await getName(client, pid);
        const cards = game.playerData[pid].cards;
        try {
            await client.sendMessage(pid, {
                message:
                    `🃏 <b>Your Cards for Card Game</b>\n\n` +
                    `a: <b>${cards.a.label}</b>\n` +
                    `b: <b>${cards.b.label}</b>\n` +
                    `c: <b>${cards.c.label}</b>\n` +
                    `d: <b>${cards.d.label}</b>\n\n` +
                    `<i>Use /flip a, /flip b, etc. in the group when it's your turn.\nHigher card wins each round!</i>`
            });
        } catch (e) {
            console.log(`[cards] Could not DM cards to ${pid}: ${e.message}`);
            // Fallback: tell them in group to start the bot first
            await client.sendMessage(chatId, {
                message: `⚠️ <b>${pName}</b>, I couldn't send your cards! Please <a href="https://t.me/${process.env.BOT_USERNAME || 'Alexagamebot'}">start the bot</a> first, then use /cards again.`
            });
        }
    }

    const currentPlayer = game.getCurrentPlayer();
    const name = await getName(client, currentPlayer);
    await client.sendMessage(chatId, {
        message: `🚀 <b>THE CARD GAME HAS BEGUN!</b>\n\nCards have been sent to each player's inbox! 📩\nEvery player has 4 cards: <b>a, b, c, d</b>.\n\nIt is now <a href="tg://user?id=${currentPlayer}">${name}</a>'s turn!\nUse <code>/flip a</code>, <code>/flip b</code>, etc. to reveal a card.`
    });
};

const processFlip = async (client, event) => {
    const text = event.message.message;
    if (!text.startsWith("/flip")) return;

    const chatId = event.chatId.toString();
    const userId = event.message.senderId.toString();
    const game = sessions.get(`cards_${chatId}`);
    if (!game || game.status !== 'playing') return;

    const cardName = text.split(" ")[1];
    const result = game.flipCard(userId, cardName);
    if (result.error) return event.message.respond({ message: result.error });

    const flipperName = await getName(client, userId);
    let msg = `🎴 <a href="tg://user?id=${userId}">${flipperName}</a> flipped card <b>${cardName}</b> and got: <b>${result.cardLabel}</b>\n\n`;

    msg += `<b>Round Progress:</b>\n`;
    for (const h of result.history) {
        const hName = await getName(client, h.userId);
        msg += `- <a href="tg://user?id=${h.userId}">${hName}</a>: ${h.label}\n`;
    }

    if (result.roundFinished) {
        msg += `\n🏁 <b>Round ${game.round - 1} finished!</b>\n`;
        for (const pid of game.players) {
            const pName = await getName(client, pid);
            msg += `- <a href="tg://user?id=${pid}">${pName}</a>: ${game.playerData[pid].points} total points\n`;
        }

        if (game.status === 'finished') {
            const winners = game.getWinner();
            const pot = game.bet * game.players.length;
            const prize = Math.floor(pot / winners.length);

            const winnerNames = [];
            for (const w of winners) winnerNames.push(await getName(client, w));
            msg += `\n🏆 <b>GAME OVER!</b>\nWinner(s): ${winnerNames.join(", ")}\nPrize: <b>$${prize}</b> each!`;

            for (const pid of game.players) {
                let u = await User.findOne({ userId: pid }) || await User.create({ userId: pid });
                if (winners.includes(pid)) {
                    u.wallet += (prize - game.bet);
                    const xpRes = await leveling.addXP(pid, 200);
                    const pName = await getName(client, pid);
                    if (xpRes.leveledUp) msg += `\n🆙 ${pName} leveled up to ${xpRes.level}!`;
                } else {
                    u.wallet -= game.bet;
                }
                await u.save();
            }
            sessions.delete(`cards_${chatId}`);
        } else {
            const nextP = game.getCurrentPlayer();
            const nextName = await getName(client, nextP);
            msg += `\n<b>Round ${game.round} Start!</b>\nNext turn: <a href="tg://user?id=${nextP}">${nextName}</a>`;
        }
    } else {
        const nextP = game.getCurrentPlayer();
        const nextName = await getName(client, nextP);
        msg += `\nNext turn: <a href="tg://user?id=${nextP}">${nextName}</a>`;
    }

    await client.sendMessage(chatId, { message: msg });
};

module.exports = { initCardGame, joinCardGame, processFlip };
