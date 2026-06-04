class CardGame {
    constructor(creatorId, bet) {
        this.creatorId = creatorId;
        this.bet = bet;
        this.players = [creatorId];
        this.status = 'lobby'; // lobby, playing, finished
        this.playerData = {}; // { userId: { cards: {a, b, c, d}, flipped: [], points: 0 } }
        this.round = 1;
        this.turnIndex = 0;
        this.currentRoundFlips = {}; // { userId: { cardName, value } }
        this.startTime = Date.now();
    }

    addPlayer(userId) {
        if (!this.players.includes(userId)) {
            this.players.push(userId);
            return true;
        }
        return false;
    }

    setupGame() {
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const cardValueMap = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

        for (const pid of this.players) {
            const shuffled = [...values].sort(() => Math.random() - 0.5);
            this.playerData[pid] = {
                cards: {
                    a: { label: shuffled[0], val: cardValueMap[shuffled[0]] },
                    b: { label: shuffled[1], val: cardValueMap[shuffled[1]] },
                    c: { label: shuffled[2], val: cardValueMap[shuffled[2]] },
                    d: { label: shuffled[3], val: cardValueMap[shuffled[3]] }
                },
                flipped: [],
                points: 0
            };
        }
        this.status = 'playing';
    }

    getCurrentPlayer() {
        return this.players[this.turnIndex];
    }

    flipCard(userId, cardName) {
        if (this.players[this.turnIndex] !== userId) return { error: "Not your turn!" };
        if (this.playerData[userId].flipped.includes(cardName)) return { error: "Card already flipped!" };
        if (!['a', 'b', 'c', 'd'].includes(cardName)) return { error: "Invalid card name! Use a, b, c, or d." };

        const card = this.playerData[userId].cards[cardName];
        this.playerData[userId].flipped.push(cardName);
        this.currentRoundFlips[userId] = { name: cardName, label: card.label, val: card.val };

        const result = {
            cardLabel: card.label,
            history: Object.entries(this.currentRoundFlips).map(([pid, data]) => ({
                userId: pid,
                label: data.label
            }))
        };

        // Move to next turn
        this.turnIndex++;
        
        // Check if round finished
        if (this.turnIndex >= this.players.length) {
            this.resolveRound();
            result.roundFinished = true;
        }

        return result;
    }

    resolveRound() {
        let maxVal = -1;
        let winners = [];

        for (const pid of this.players) {
            const val = this.currentRoundFlips[pid].val;
            if (val > maxVal) {
                maxVal = val;
                winners = [pid];
            } else if (val === maxVal) {
                winners.push(pid);
            }
        }

        for (const winId of winners) {
            this.playerData[winId].points += 1;
        }

        this.round++;
        this.turnIndex = 0;
        this.currentRoundFlips = {};
        
        if (this.round > 4) {
            this.status = 'finished';
        }
    }

    getWinner() {
        let maxPoints = -1;
        let winners = [];
        for (const pid of this.players) {
            if (this.playerData[pid].points > maxPoints) {
                maxPoints = this.playerData[pid].points;
                winners = [pid];
            } else if (this.playerData[pid].points === maxPoints) {
                winners.push(pid);
            }
        }
        return winners;
    }
}

module.exports = CardGame;
