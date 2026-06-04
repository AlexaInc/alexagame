const { Api } = require("telegram");
const User = require('../models/User');
const sessions = require('../games/sessions');

// --- Helper: Build 3x3 Grid for Mines/TicTacToe ---
const buildGrid = (gameId, grid, prefix) => {
    const buttons = [];
    for (let r = 0; r < 3; r++) {
        const row = [];
        for (let c = 0; c < 3; c++) {
            const val = grid[r][c];
            row.push(Api.KeyboardButtonCallback({ text: val || '⬜', data: `${prefix}_${gameId}_${r}_${c}` }));
        }
        buttons.push(row);
    }
    return buttons;
};

// 1. Slots Game
const startSlots = async (client, event) => {
    const userId = event.senderId.toString();
    const items = ['🍎', '🍋', '🍒', '💎', '🔔'];
    const bet = 50;
    
    const user = await User.findOne({ userId });
    if (user.wallet < bet) return event.reply({ message: "Min bet $50." });

    const result = [
        items[Math.floor(Math.random() * items.length)],
        items[Math.floor(Math.random() * items.length)],
        items[Math.floor(Math.random() * items.length)]
    ];

    let msg = `🎰 **SLOTS** 🎰\n\n| ${result[0]} | ${result[1]} | ${result[2]} |\n\n`;
    
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
    await event.reply({ message: msg });
};

// 2. Mines (Inline)
const startMines = async (client, event) => {
    const userId = event.senderId.toString();
    const gameId = `mines_${userId}_${Date.now()}`;
    const grid = [['⬜', '⬜', '⬜'], ['⬜', '⬜', '⬜'], ['⬜', '⬜', '⬜']];
    const mines = [];
    while (mines.length < 2) {
        const r = Math.floor(Math.random() * 3);
        const c = Math.floor(Math.random() * 3);
        if (!mines.some(m => m.r === r && m.c === c)) mines.push({ r, c });
    }

    sessions.set(gameId, { type: 'mines', userId, grid, mines, bet: 100, revealed: 0 });
    
    await client.sendMessage(event.chatId, {
        message: "💣 **MINES** 💣\nAvoid the 2 mines! Each safe square multiplies your win.",
        buttons: client.buildReplyMarkup(buildGrid(gameId, grid, 'mines_click'))
    });
};

// 3. Rock Paper Scissors (Multiplayer)
const startRPS = async (client, event) => {
    const userId = event.senderId.toString();
    const bet = 200;
    const gameId = `rps_${userId}_${Date.now()}`;
    
    sessions.set(gameId, { type: 'rps', creator: userId, bet, moves: {} });

    await client.sendMessage(event.chatId, {
        message: `✊✌️✋ **RPS BATTLE**\nBet: $${bet}\n\nWaiting for players to choose...`,
        buttons: client.buildReplyMarkup([
            [
                Api.KeyboardButtonCallback({ text: "Rock ✊", data: `rps_move_${gameId}_rock` }),
                Api.KeyboardButtonCallback({ text: "Paper ✋", data: `rps_move_${gameId}_paper` }),
                Api.KeyboardButtonCallback({ text: "Scissors ✌️", data: `rps_move_${gameId}_scissors` })
            ]
        ])
    });
};

// 4. Coin Flip (Inline)
const startFlip = async (client, event) => {
    const userId = event.senderId.toString();
    const gameId = `flip_${userId}_${Date.now()}`;
    
    await client.sendMessage(event.chatId, {
        message: "🪙 **COIN FLIP**\nPick Heads or Tails!",
        buttons: client.buildReplyMarkup([[
            Api.KeyboardButtonCallback({ text: "Heads", data: `flip_play_${gameId}_heads` }),
            Api.KeyboardButtonCallback({ text: "Tails", data: `flip_play_${gameId}_tails` })
        ]])
    });
};

// ... and so on for others. I'll bundle the handler for all below.
// 5. Russian Roulette
const startRoulette = async (client, event) => {
    const userId = event.senderId.toString();
    const gameId = `roulette_${userId}_${Date.now()}`;
    
    await client.sendMessage(event.chatId, {
        message: "🔫 **RUSSIAN ROULETTE**\n1 bullet, 6 chambers. Do you feel lucky?\nWin 5x your bet if you survive.",
        buttons: client.buildReplyMarkup([[
            Api.KeyboardButtonCallback({ text: "Pull Trigger 💥", data: `roulette_pull_${gameId}` })
        ]])
    });
};

// 6. Higher or Lower
const startHL = async (client, event) => {
    const userId = event.senderId.toString();
    const gameId = `hl_${userId}_${Date.now()}`;
    const startNum = Math.floor(Math.random() * 10) + 1;
    
    sessions.set(gameId, { type: 'hl', userId, lastNum: startNum, bet: 100, streak: 0 });

    await client.sendMessage(event.chatId, {
        message: `📈 **HIGHER OR LOWER**\nCurrent Number: **${startNum}**\nWill the next number (1-13) be Higher or Lower?`,
        buttons: client.buildReplyMarkup([[
            Api.KeyboardButtonCallback({ text: "Higher ⬆️", data: `hl_play_${gameId}_higher` }),
            Api.KeyboardButtonCallback({ text: "Lower ⬇️", data: `hl_play_${gameId}_lower` })
        ]])
    });
};

module.exports = { startSlots, startMines, startRPS, startFlip, startRoulette, startHL, buildGrid };
