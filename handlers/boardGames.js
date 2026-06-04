const { Api } = require("telegram");
const User = require('../models/User');
const TicTacToe = require('../games/TicTacToe');
const Connect4 = require('../games/Connect4');
const sessions = require('../games/sessions');

const startXOX = async (client, event) => {
    const bet = parseInt(event.message.message.split(" ")[1]) || 100;
    const userId = event.senderId.toString();
    const gameId = `xox_${userId}_${Date.now()}`;
    
    sessions.set(gameId, new TicTacToe(userId, bet));

    await client.sendMessage(event.chatId, {
        message: `❌⭕ **TIC-TAC-TOE**\nBet: $${bet}\nCreator: ${userId}\n\nWaiting for opponent to join...`,
        buttons: client.buildReplyMarkup([
            [Api.KeyboardButtonCallback({ text: "Join Game", data: `xox_join_${gameId}` })]
        ])
    });
};

const startC4 = async (client, event) => {
    const bet = parseInt(event.message.message.split(" ")[1]) || 200;
    const userId = event.senderId.toString();
    const gameId = `c4_${userId}_${Date.now()}`;
    
    sessions.set(gameId, new Connect4(userId, bet));

    await client.sendMessage(event.chatId, {
        message: `🔴🟡 **CONNECT FOUR**\nBet: $${bet}\nCreator: ${userId}\n\nWaiting for opponent...`,
        buttons: client.buildReplyMarkup([
            [Api.KeyboardButtonCallback({ text: "Join Game", data: `c4_join_${gameId}` })]
        ])
    });
};

module.exports = { startXOX, startC4 };
