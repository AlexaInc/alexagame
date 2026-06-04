const { Api } = require("telegram");
const User = require('../models/User');
const Blackjack = require('../games/Blackjack');
const sessions = require('../games/sessions');

const startBJ = async (client, event) => {
    const bet = parseInt(event.message.message.split(" ")[1]) || 100;
    const userId = event.senderId.toString();
    const user = await User.findOne({ userId });

    if (user.wallet < bet) return event.reply({ message: "Insufficient funds!" });

    const gameId = `bj_${userId}_${Date.now()}`;
    const game = new Blackjack(userId, bet);
    sessions.set(gameId, game);

    await updateBJBoard(client, event.chatId, null, game, gameId);
};

async function updateBJBoard(client, peer, msgId, game, gameId) {
    const dealerHand = game.status === 'playing' 
        ? `${game.players['dealer'].hand[0].v}${game.players['dealer'].hand[0].s} ❓`
        : game.players['dealer'].hand.map(c => `${c.v}${c.s}`).join(" ");
    
    const playerHand = game.players[game.creatorId].hand.map(c => `${c.v}${c.s}`).join(" ");
    
    let message = `🃏 **BLACKJACK**\nBet: $${game.bet}\n\n`;
    message += `🏦 **Dealer:** ${dealerHand} (Score: ${game.status === 'playing' ? '?' : game.players['dealer'].score})\n`;
    message += `👤 **You:** ${playerHand} (Score: ${game.players[game.creatorId].score})`;

    let buttons = [];
    if (game.status === 'playing') {
        buttons = [[
            Api.KeyboardButtonCallback({ text: "Hit ➕", data: `bj_hit_${gameId}` }),
            Api.KeyboardButtonCallback({ text: "Stand ✋", data: `bj_stand_${gameId}` })
        ]];
    }

    if (msgId) {
        await client.editMessage(peer, { id: msgId, message, buttons: client.buildReplyMarkup(buttons) });
    } else {
        await client.sendMessage(peer, { message, buttons: client.buildReplyMarkup(buttons) });
    }
}

const handleBJCallback = async (client, update) => {
    const data = update.data.toString();
    if (!data.startsWith("bj_")) return;

    const userId = update.userId.toString();
    const parts = data.split("_");
    const action = parts[1];
    const gameId = parts.slice(2).join("_");
    const game = sessions.get(gameId);

    if (!game || game.creatorId !== userId || game.status !== 'playing') return;

    if (action === 'hit') {
        game.deal(userId);
        if (game.players[userId].score > 21) {
            game.status = 'bust';
            await finalizeBJ(client, update.peer, update.msgId, game, gameId, 'bust');
        } else {
            await updateBJBoard(client, update.peer, update.msgId, game, gameId);
        }
    } else if (action === 'stand') {
        // Dealer plays
        while (game.players['dealer'].score < 17) {
            game.deal('dealer');
        }
        
        let result = '';
        const pScore = game.players[userId].score;
        const dScore = game.players['dealer'].score;

        if (dScore > 21 || pScore > dScore) result = 'win';
        else if (dScore > pScore) result = 'lose';
        else result = 'push';

        game.status = 'finished';
        await finalizeBJ(client, update.peer, update.msgId, game, gameId, result);
    }
};

const leveling = require('../utils/leveling');

async function finalizeBJ(client, peer, msgId, game, gameId, result) {
    const user = await User.findOne({ userId: game.creatorId });
    let finalMsg = "";

    if (result === 'win') {
        user.wallet += game.bet;
        const xpRes = await leveling.addXP(game.creatorId, 50);
        finalMsg = `🎉 **YOU WIN!** You gained $${game.bet} and 50 XP.`;
        if (xpRes.leveledUp) finalMsg += `\n🆙 Leveled up to ${xpRes.level}!`;
    } else if (result === 'lose' || result === 'bust') {
        user.wallet -= game.bet;
        finalMsg = result === 'bust' ? `💥 **BUST!** You exceeded 21. Lost $${game.bet}.` : `💀 **DEALER WINS!** Lost $${game.bet}.`;
    } else {
        finalMsg = "🤝 **PUSH!** It's a draw, money returned.";
    }

    await user.save();
    
    const dealerHand = game.players['dealer'].hand.map(c => `${c.v}${c.s}`).join(" ");
    const playerHand = game.players[game.creatorId].hand.map(c => `${c.v}${c.s}`).join(" ");
    
    let message = `🃏 **BLACKJACK - ${result.toUpperCase()}**\nBet: $${game.bet}\n\n`;
    message += `🏦 **Dealer:** ${dealerHand} (Score: ${game.players['dealer'].score})\n`;
    message += `👤 **You:** ${playerHand} (Score: ${game.players[game.creatorId].score})\n\n`;
    message += finalMsg;

    await client.editMessage(peer, { id: msgId, message, buttons: null });
    sessions.delete(gameId);
}

module.exports = { startBJ, handleBJCallback };
