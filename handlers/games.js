const { Api } = require("telegram");
const User = require('../models/User');
const HackGame = require('../games/HackGame');
const sessions = require('../games/sessions');
const { editMsg } = require('../utils/editMsg');

const startHack = async (client, event) => {
    const parts = event.message.message.split(" ");
    const bet = parseInt(parts[1]) || 100;
    const length = parseInt(parts[2]) || 4;

    const userId = event.message.senderId.toString();
    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId });

    if (user.wallet < bet) return event.message.respond({ message: "Insufficient funds!" });
    if (length < 3 || length > 6) return event.message.respond({ message: "Length must be 3-6." });

    const gameId = `hack:${userId}:${Date.now()}`;
    const game = new HackGame(length, bet);
    sessions.set(gameId, { type: 'hack', game, userId });

    await client.sendMessage(event.chatId, {
        message: `🔍 <b>HACK INITIALIZED</b>\nBet: $${bet}\nLength: ${length}\nGuess the ${length}-digit PIN:\n\nInput: [ ${"_".repeat(length)} ]`,
        buttons: client.buildReplyMarkup(buildHackKeyboard(gameId))
    });
};

function buildHackKeyboard(gameId) {
    const buttons = [];
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    let row = [];
    for (const d of digits) {
        row.push(new Api.KeyboardButtonCallback({ text: d, data: Buffer.from(`hinp|${gameId}|${d}`) }));
        if (row.length === 3) { buttons.push(row); row = []; }
    }
    if (row.length > 0) buttons.push(row);
    buttons.push([
        new Api.KeyboardButtonCallback({ text: "CLR", data: Buffer.from(`hclr|${gameId}`) }),
        new Api.KeyboardButtonCallback({ text: "ENTER", data: Buffer.from(`hent|${gameId}`) })
    ]);
    return buttons;
}

const handleCallback = async (client, update) => {
    const data = update.data.toString();
    const userId = update.userId.toString();

    if (!data.startsWith("hinp|") && !data.startsWith("hclr|") && !data.startsWith("hent|")) return;

    const parts = data.split("|");
    const action = parts[0];
    const gameId = parts[1];
    const val = parts[2];

    const session = sessions.get(gameId);
    if (!session || session.userId !== userId) return;
    const { game } = session;

    if (action === "hinp") {
        if (game.currentGuess.length < game.length) game.currentGuess += val;
    } else if (action === "hclr") {
        game.currentGuess = "";
    } else if (action === "hent") {
        if (game.currentGuess.length !== game.length) return;

        const result = game.checkGuess(game.currentGuess);
        game.attempts++;

        if (result.bulls === game.length) {
            let user = await User.findOne({ userId });
            if (!user) user = await User.create({ userId });
            const prize = game.bet * game.length;
            user.wallet += prize;
            await user.save();
            await editMsg(client, update.peer, update.msgId, `🎯 <b>ACCESS GRANTED</b>\n\nPIN: ${game.target}\nReward: $${prize}`, null);
            sessions.delete(gameId);
            return;
        } else if (game.attempts >= game.maxAttempts) {
            let user = await User.findOne({ userId });
            if (!user) user = await User.create({ userId });
            user.wallet -= game.bet;
            await user.save();
            await editMsg(client, update.peer, update.msgId, `❌ <b>SYSTEM LOCKED</b>\n\nPIN was: ${game.target}\nLost: $${game.bet}`, null);
            sessions.delete(gameId);
            return;
        } else {
            game.lastResult = `Guess: ${game.currentGuess} → Bulls: ${result.bulls}, Cows: ${result.cows}`;
            game.currentGuess = "";
        }
    }

    const displayGuess = game.currentGuess.padEnd(game.length, "_");
    await editMsg(client, update.peer, update.msgId,
        `🔍 <b>HACKING...</b>\nBet: $${game.bet}\nAttempt: ${game.attempts}/${game.maxAttempts}\nLast: ${game.lastResult || "None"}\n\nInput: [ ${displayGuess} ]`,
        buildHackKeyboard(gameId));
};

const startDice = async (client, event) => {
    const parts = event.message.message.split(" ");
    const bet = parseInt(parts[1]);
    if (isNaN(bet) || bet <= 0) return event.message.respond({ message: "Usage: /dice <bet>" });

    const userId = event.message.senderId.toString();
    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId });
    if (user.wallet < bet) return event.message.respond({ message: "Insufficient funds!" });

    const gameId = `dice:${userId}:${Date.now()}`;
    const session = { type: 'dice', creator: userId, bet, status: 'pending' };
    sessions.set(gameId, session);

    const { getName } = require('../utils/getName');
    const name = await getName(client, userId);

    const sent = await client.sendMessage(event.chatId, {
        message: `🎲 <b>DICE DUEL</b>\nBet: $${bet} each (Pot: $${bet*2})\n${name} is waiting for opponent...`,
        buttons: client.buildReplyMarkup([
            [new Api.KeyboardButtonCallback({ text: "Join Duel", data: Buffer.from(`djoin|${gameId}`) })]
        ])
    });

    session._lobbyTimer = setTimeout(async () => {
        const s = sessions.get(gameId);
        if (!s || s.status !== 'pending') return;
        sessions.delete(gameId);
        try { await editMsg(client, event.chatId, sent.id, `🎲 <b>DICE DUEL</b>\n⏳ Lobby expired. No opponent joined.`, null); } catch (e) {}
    }, 60000);
};

const handleDiceCallback = async (client, update) => {
    const data = update.data.toString();
    const userId = update.userId.toString();
    if (!data.startsWith("djoin|")) return;

    const gameId = data.replace("djoin|", "");
    const session = sessions.get(gameId);
    if (!session || session.status !== 'pending') return;
    if (session.creator === userId) return;

    let opponent = await User.findOne({ userId });
    if (!opponent) opponent = await User.create({ userId });
    if (opponent.wallet < session.bet) return;

    if (session._lobbyTimer) { clearTimeout(session._lobbyTimer); session._lobbyTimer = null; }

    let creator = await User.findOne({ userId: session.creator });
    if (!creator) creator = await User.create({ userId: session.creator });

    // Charge both
    creator.wallet -= session.bet;
    opponent.wallet -= session.bet;

    const creatorRoll = Math.floor(Math.random() * 6) + 1;
    const opponentRoll = Math.floor(Math.random() * 6) + 1;
    const pot = session.bet * 2;

    let resultMsg = `🎲 <b>DICE DUEL RESULT</b>\n\nCreator: 🎲 ${creatorRoll}\nOpponent: 🎲 ${opponentRoll}\n\n`;
    if (creatorRoll > opponentRoll) {
        creator.wallet += pot;
        resultMsg += `🏆 Creator wins <b>$${pot}</b>`;
    } else if (opponentRoll > creatorRoll) {
        opponent.wallet += pot;
        resultMsg += `🏆 Opponent wins <b>$${pot}</b>`;
    } else {
        creator.wallet += session.bet;
        opponent.wallet += session.bet;
        resultMsg += `🤝 Draw! Bets refunded.`;
    }
    await creator.save(); await opponent.save();
    sessions.delete(gameId);
    await editMsg(client, update.peer, update.msgId, resultMsg, null);
};

module.exports = { startHack, startDice, handleCallback, handleDiceCallback };
