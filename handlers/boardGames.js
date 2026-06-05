const { Api } = require("telegram");
const User = require('../models/User');
const TicTacToe = require('../games/TicTacToe');
const Connect4 = require('../games/Connect4');
const sessions = require('../games/sessions');
const { editMsg } = require('../utils/editMsg');
const { getName } = require('../utils/getName');

const startXOX = async (client, event) => {
    const bet = parseInt(event.message.message.split(" ")[1]) || 100;
    const userId = event.message.senderId.toString();
    const gameId = `xox:${userId}:${Date.now()}`;
    const name = await getName(client, userId);
    const game = new TicTacToe(userId, bet);
    sessions.set(gameId, game);

    const sent = await client.sendMessage(event.chatId, {
        message: `❌⭕ <b>TIC-TAC-TOE</b>\nBet: $${bet} each (Pot: $${bet*2})\n${name} is waiting for opponent...`,
        buttons: client.buildReplyMarkup([
            [new Api.KeyboardButtonCallback({ text: "Join Game", data: Buffer.from(`xjoin|${gameId}`) })]
        ])
    });

    game._lobbyTimer = setTimeout(async () => {
        const g = sessions.get(gameId);
        if (!g || g.status !== 'lobby') return;
        sessions.delete(gameId);
        try { await editMsg(client, event.chatId, sent.id, `❌⭕ <b>TIC-TAC-TOE</b>\n⏳ Lobby expired. No opponent joined.`, null); } catch (e) {}
    }, 60000);
};

const startC4 = async (client, event) => {
    const bet = parseInt(event.message.message.split(" ")[1]) || 200;
    const userId = event.message.senderId.toString();
    const gameId = `c4:${userId}:${Date.now()}`;
    const name = await getName(client, userId);
    const game = new Connect4(userId, bet);
    sessions.set(gameId, game);

    const sent = await client.sendMessage(event.chatId, {
        message: `🔴🟡 <b>CONNECT FOUR</b>\nBet: $${bet} each (Pot: $${bet*2})\n${name} is waiting for opponent...`,
        buttons: client.buildReplyMarkup([
            [new Api.KeyboardButtonCallback({ text: "Join Game", data: Buffer.from(`cjoin|${gameId}`) })]
        ])
    });

    game._lobbyTimer = setTimeout(async () => {
        const g = sessions.get(gameId);
        if (!g || g.status !== 'lobby') return;
        sessions.delete(gameId);
        try { await editMsg(client, event.chatId, sent.id, `🔴🟡 <b>CONNECT FOUR</b>\n⏳ Lobby expired. No opponent joined.`, null); } catch (e) {}
    }, 60000);
};

module.exports = { startXOX, startC4 };
