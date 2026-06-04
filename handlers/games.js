const { Api } = require("telegram");
const User = require('../models/User');
const HackGame = require('../games/HackGame');
const sessions = require('../games/sessions');

const startHack = async (client, event) => {
    const parts = event.message.message.split(" ");
    const bet = parseInt(parts[1]) || 100;
    const length = parseInt(parts[2]) || 4;

    const userId = event.senderId.toString();
    const user = await User.findOne({ userId });

    if (user.wallet < bet) return event.reply({ message: "Insufficient funds!" });
    if (length < 3 || length > 6) return event.reply({ message: "Length must be 3-6." });

    const gameId = `hack_${userId}_${Date.now()}`;
    const game = new HackGame(length, bet);
    sessions.set(gameId, { type: 'hack', game, userId });

    const buttons = [];
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    let row = [];
    for (const d of digits) {
        row.push(Api.KeyboardButtonCallback({ text: d, data: `hack_input_${gameId}_${d}` }));
        if (row.length === 3) {
            buttons.push(row);
            row = [];
        }
    }
    if (row.length > 0) buttons.push(row);
    buttons.push([
        Api.KeyboardButtonCallback({ text: "CLR", data: `hack_clear_${gameId}` }),
        Api.KeyboardButtonCallback({ text: "ENTER", data: `hack_enter_${gameId}` })
    ]);

    await client.sendMessage(event.chatId, {
        message: `🔍 **HACK INITIALIZED**\nBet: $${bet}\nLength: ${length}\nGuess the ${length}-digit PIN:\n\nInput: [ ____ ]`,
        buttons: client.buildReplyMarkup(buttons)
    });
};

const handleCallback = async (client, update) => {
    const data = update.data.toString();
    const userId = update.userId.toString();

    if (data.startsWith("hack_")) {
        const parts = data.split("_");
        const action = parts[1];
        const gameId = parts.slice(2, -1).join("_") || parts[2];
        const val = parts[parts.length - 1];

        const session = sessions.get(gameId === "clear" || gameId === "enter" ? parts[2] : gameId);
        if (!session || session.userId !== userId) return;

        const { game } = session;

        if (action === "input") {
            if (game.currentGuess.length < game.length) {
                game.currentGuess += val;
            }
        } else if (action === "clear") {
            game.currentGuess = "";
        } else if (action === "enter") {
            if (game.currentGuess.length !== game.length) return;
            
            const result = game.checkGuess(game.currentGuess);
            game.attempts++;

            if (result.bulls === game.length) {
                // WIN
                const user = await User.findOne({ userId });
                const prize = game.bet * game.length;
                user.wallet += prize;
                await user.save();
                
                await client.editMessage(update.peer, {
                    id: update.msgId,
                    message: `🎯 **ACCESS GRANTED**\n\nPIN: ${game.target}\nReward: $${prize}\nUser: ${userId}`,
                    buttons: null
                });
                sessions.delete(gameId);
                return;
            } else if (game.attempts >= game.maxAttempts) {
                // LOSE
                const user = await User.findOne({ userId });
                user.wallet -= game.bet;
                await user.save();

                await client.editMessage(update.peer, {
                    id: update.msgId,
                    message: `❌ **SYSTEM LOCKED**\n\nYou failed to crack the PIN: ${game.target}\nLost: $${game.bet}`,
                    buttons: null
                });
                sessions.delete(gameId);
                return;
            } else {
                // CONTINUE
                const history = `Guess: ${game.currentGuess} -> Bulls: ${result.bulls}, Cows: ${result.cows}`;
                game.lastResult = history;
                game.currentGuess = "";
            }
        }

        const displayGuess = game.currentGuess.padEnd(game.length, "_");
        await client.editMessage(update.peer, {
            id: update.msgId,
            message: `🔍 **HACKING...**\nBet: $${game.bet}\nAttempt: ${game.attempts}/${game.maxAttempts}\nLast: ${game.lastResult || "None"}\n\nInput: [ ${displayGuess} ]`,
            buttons: update.message.replyMarkup
        });
    }
};

const startDice = async (client, event) => {
    const parts = event.message.message.split(" ");
    const bet = parseInt(parts[1]);
    if (isNaN(bet) || bet <= 0) return event.reply({ message: "Usage: /dice <bet>" });

    const userId = event.senderId.toString();
    const user = await User.findOne({ userId });
    if (user.wallet < bet) return event.reply({ message: "Insufficient funds!" });

    const gameId = `dice_${userId}_${Date.now()}`;
    sessions.set(gameId, { type: 'dice', creator: userId, bet, status: 'pending' });

    await client.sendMessage(event.chatId, {
        message: `🎲 **DICE DUEL**\nCreator: ${userId}\nBet: $${bet}\n\nWaiting for an opponent...`,
        buttons: client.buildReplyMarkup([
            [Api.KeyboardButtonCallback({ text: "Join Duel", data: `dice_join_${gameId}` })]
        ])
    });
};

const handleDiceCallback = async (client, update) => {
    const data = update.data.toString();
    const userId = update.userId.toString();

    if (data.startsWith("dice_join_")) {
        const gameId = data.replace("dice_join_", "");
        const session = sessions.get(gameId);

        if (!session || session.status !== 'pending') return;
        if (session.creator === userId) return;

        const opponent = await User.findOne({ userId });
        if (opponent.wallet < session.bet) return;

        session.opponent = userId;
        session.status = 'playing';

        const creatorRoll = Math.floor(Math.random() * 6) + 1;
        const opponentRoll = Math.floor(Math.random() * 6) + 1;

        let resultMsg = `🎲 **DICE DUEL RESULT**\n\n`;
        resultMsg += `Creator (${session.creator}): ${creatorRoll}\n`;
        resultMsg += `Opponent (${userId}): ${opponentRoll}\n\n`;

        const creator = await User.findOne({ userId: session.creator });
        
        if (creatorRoll > opponentRoll) {
            creator.wallet += session.bet;
            opponent.wallet -= session.bet;
            resultMsg += `🏆 **Winner: Creator!** (+$${session.bet})`;
        } else if (opponentRoll > creatorRoll) {
            creator.wallet -= session.bet;
            opponent.wallet += session.bet;
            resultMsg += `🏆 **Winner: Opponent!** (+$${session.bet})`;
        } else {
            resultMsg += `🤝 **It's a Draw!** No money lost.`;
        }

        await creator.save();
        await opponent.save();
        sessions.delete(gameId);

        await client.editMessage(update.peer, {
            id: update.msgId,
            message: resultMsg,
            buttons: null
        });
    }
};

module.exports = { startHack, startDice, handleCallback, handleDiceCallback };
