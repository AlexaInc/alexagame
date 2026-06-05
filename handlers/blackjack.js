const { Api } = require("telegram");
const User = require('../models/User');
const Blackjack = require('../games/Blackjack');
const sessions = require('../games/sessions');
const leveling = require('../utils/leveling');
const { editMsg } = require('../utils/editMsg');

const startBJ = async (client, event) => {
    const bet = parseInt(event.message.message.split(" ")[1]) || 100;
    const userId = event.message.senderId.toString();
    let user = await User.findOne({ userId }) || await User.create({ userId });
    if (user.wallet < bet) return event.message.respond({ message: "Insufficient funds!" });

    const gameId = `bj:${userId}:${Date.now()}`;
    const game = new Blackjack(userId, bet);
    sessions.set(gameId, game);
    await sendBJBoard(client, event.chatId, game, gameId);
};

function bjButtons(gameId) {
    return [[
        new Api.KeyboardButtonCallback({ text: "Hit ➕", data: Buffer.from(`bjhit|${gameId}`) }),
        new Api.KeyboardButtonCallback({ text: "Stand ✋", data: Buffer.from(`bjstd|${gameId}`) })
    ]];
}

function bjText(game, showDealer) {
    const dHand = showDealer
        ? game.players['dealer'].hand.map(c => `${c.v}${c.s}`).join(" ")
        : `${game.players['dealer'].hand[0].v}${game.players['dealer'].hand[0].s} ❓`;
    const pHand = game.players[game.creatorId].hand.map(c => `${c.v}${c.s}`).join(" ");
    return `🃏 <b>BLACKJACK</b> | Bet: $${game.bet}\n\n🏦 Dealer: ${dHand} (${showDealer ? game.players['dealer'].score : '?'})\n👤 You: ${pHand} (${game.players[game.creatorId].score})`;
}

async function sendBJBoard(client, peer, game, gameId) {
    await client.sendMessage(peer, {
        message: bjText(game, false),
        buttons: client.buildReplyMarkup(bjButtons(gameId))
    });
}

const handleBJCallback = async (client, update) => {
    const data = update.data.toString();
    if (!data.startsWith("bjhit|") && !data.startsWith("bjstd|")) return;
    const userId = update.userId.toString();
    const action = data.split("|")[0];
    const gameId = data.split("|")[1];
    const game = sessions.get(gameId);
    if (!game || game.creatorId !== userId || game.status !== 'playing') return;

    if (action === 'bjhit') {
        game.deal(userId);
        if (game.players[userId].score > 21) {
            game.status = 'bust';
            await finalizeBJ(client, update.peer, update.msgId, game, gameId, 'bust');
        } else {
            await editMsg(client, update.peer, update.msgId, bjText(game, false), bjButtons(gameId));
        }
    } else if (action === 'bjstd') {
        while (game.players['dealer'].score < 17) game.deal('dealer');
        const p = game.players[userId].score, d = game.players['dealer'].score;
        const result = d > 21 || p > d ? 'win' : d > p ? 'lose' : 'push';
        game.status = 'finished';
        await finalizeBJ(client, update.peer, update.msgId, game, gameId, result);
    }
};

async function finalizeBJ(client, peer, msgId, game, gameId, result) {
    let user = await User.findOne({ userId: game.creatorId }) || await User.create({ userId: game.creatorId });
    let extra = "";
    if (result === 'win') {
        user.wallet += game.bet;
        const xp = await leveling.addXP(game.creatorId, 50);
        extra = `\n\n🎉 <b>YOU WIN!</b> +$${game.bet} +50XP`;
        if (xp.leveledUp) extra += ` 🆙 Lv${xp.level}!`;
    } else if (result === 'lose' || result === 'bust') {
        user.wallet -= game.bet;
        extra = result === 'bust' ? `\n\n💥 <b>BUST!</b> Lost $${game.bet}` : `\n\n💀 <b>DEALER WINS!</b> Lost $${game.bet}`;
    } else { extra = "\n\n🤝 <b>PUSH!</b> Draw."; }
    await user.save();
    await editMsg(client, peer, msgId, bjText(game, true) + extra, null);
    sessions.delete(gameId);
}

module.exports = { startBJ, handleBJCallback };
