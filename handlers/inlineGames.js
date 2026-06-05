const { Api } = require("telegram");
const User = require('../models/User');
const sessions = require('../games/sessions');

// --- Helper: Build 3x3 Grid for Mines ---
const buildMinesGrid = (gameId, grid) => {
    const buttons = [];
    for (let r = 0; r < 3; r++) {
        const row = [];
        for (let c = 0; c < 3; c++) {
            const val = grid[r][c];
            row.push(new Api.KeyboardButtonCallback({
                text: val || '⬜',
                data: Buffer.from(`mines|${gameId}|${r}|${c}`)
            }));
        }
        buttons.push(row);
    }
    return buttons;
};

// 1. Slots Game
const startSlots = async (client, event) => {
    const userId = event.message.senderId.toString();
    const items = ['🍎', '🍋', '🍒', '💎', '🔔'];
    const bet = 50;

    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId });
    if (user.wallet < bet) return event.message.respond({ message: "Min bet $50." });

    const result = [
        items[Math.floor(Math.random() * items.length)],
        items[Math.floor(Math.random() * items.length)],
        items[Math.floor(Math.random() * items.length)]
    ];

    let msg = `🎰 <b>SLOTS</b> 🎰\n\n| ${result[0]} | ${result[1]} | ${result[2]} |\n\n`;

    if (result[0] === result[1] && result[1] === result[2]) {
        user.wallet += bet * 10;
        msg += `🔥 JACKPOT! You won $${bet * 10}!`;
    } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
        user.wallet += bet * 2;
        msg += `✨ Small Win! You won $${bet * 2}!`;
    } else {
        user.wallet -= bet;
        msg += `💀 Better luck next time. Lost $${bet}.`;
    }
    await user.save();
    await event.message.respond({ message: msg });
};

// 2. Mines (Inline)
const startMines = async (client, event) => {
    const userId = event.message.senderId.toString();
    const gameId = `mines:${userId}:${Date.now()}`;
    const grid = [['⬜', '⬜', '⬜'], ['⬜', '⬜', '⬜'], ['⬜', '⬜', '⬜']];
    const mines = [];
    while (mines.length < 2) {
        const r = Math.floor(Math.random() * 3);
        const c = Math.floor(Math.random() * 3);
        if (!mines.some(m => m.r === r && m.c === c)) mines.push({ r, c });
    }

    sessions.set(gameId, { type: 'mines', userId, grid, mines, bet: 100, revealed: 0 });

    await client.sendMessage(event.chatId, {
        message: "💣 <b>MINES</b> 💣\nAvoid the 2 mines! Each safe square multiplies your win.",
        buttons: client.buildReplyMarkup(buildMinesGrid(gameId, grid))
    });
};

// 3. Coin Flip (Inline)
const startFlip = async (client, event) => {
    const userId = event.message.senderId.toString();
    const gameId = `flip:${userId}:${Date.now()}`;

    await client.sendMessage(event.chatId, {
        message: "🪙 <b>COIN FLIP</b>\nPick Heads or Tails!",
        buttons: client.buildReplyMarkup([[
            new Api.KeyboardButtonCallback({ text: "Heads", data: Buffer.from(`flip|${gameId}|heads`) }),
            new Api.KeyboardButtonCallback({ text: "Tails", data: Buffer.from(`flip|${gameId}|tails`) })
        ]])
    });
};

// 4. Russian Roulette
const startRoulette = async (client, event) => {
    const userId = event.message.senderId.toString();
    const gameId = `roulette:${userId}:${Date.now()}`;

    await client.sendMessage(event.chatId, {
        message: "🔫 <b>RUSSIAN ROULETTE</b>\n1 bullet, 6 chambers. Do you feel lucky?\nWin 5x your bet if you survive.",
        buttons: client.buildReplyMarkup([[
            new Api.KeyboardButtonCallback({ text: "Pull Trigger 💥", data: Buffer.from(`roulette|${gameId}`) })
        ]])
    });
};

// 5. Higher or Lower
const startHL = async (client, event) => {
    const userId = event.message.senderId.toString();
    const gameId = `hl:${userId}:${Date.now()}`;
    const startNum = Math.floor(Math.random() * 10) + 1;

    sessions.set(gameId, { type: 'hl', userId, lastNum: startNum, bet: 100, streak: 0 });

    await client.sendMessage(event.chatId, {
        message: `📈 <b>HIGHER OR LOWER</b>\nCurrent Number: <b>${startNum}</b>\nWill the next number (1-13) be Higher or Lower?`,
        buttons: client.buildReplyMarkup([[
            new Api.KeyboardButtonCallback({ text: "Higher ⬆️", data: Buffer.from(`hl|${gameId}|higher`) }),
            new Api.KeyboardButtonCallback({ text: "Lower ⬇️", data: Buffer.from(`hl|${gameId}|lower`) })
        ]])
    });
};

// 6. Rock Paper Scissors (Multiplayer)
const startRPS = async (client, event) => {
    const userId = event.message.senderId.toString();
    const bet = 200;
    const gameId = `rps:${userId}:${Date.now()}`;

    sessions.set(gameId, { type: 'rps', creator: userId, bet, moves: {} });

    await client.sendMessage(event.chatId, {
        message: `✊✌️✋ <b>RPS BATTLE</b>\nBet: $${bet}\n\nWaiting for players to choose...`,
        buttons: client.buildReplyMarkup([
            [
                new Api.KeyboardButtonCallback({ text: "Rock ✊", data: Buffer.from(`rps|${gameId}|rock`) }),
                new Api.KeyboardButtonCallback({ text: "Paper ✋", data: Buffer.from(`rps|${gameId}|paper`) }),
                new Api.KeyboardButtonCallback({ text: "Scissors ✌️", data: Buffer.from(`rps|${gameId}|scissors`) })
            ]
        ])
    });
};

module.exports = { startSlots, startMines, startRPS, startFlip, startRoulette, startHL, buildMinesGrid };
