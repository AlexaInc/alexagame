class Blackjack {
    constructor(creatorId, bet) {
        this.creatorId = creatorId;
        this.bet = bet;
        this.deck = this.createDeck();
        this.players = {
            [creatorId]: { hand: [], score: 0, status: 'playing' },
            'dealer': { hand: [], score: 0, status: 'playing' }
        };
        this.status = 'playing';
        
        // Initial Deal
        this.deal(creatorId);
        this.deal(creatorId);
        this.deal('dealer');
        this.deal('dealer');
    }

    createDeck() {
        const suits = ['♠️', '♥️', '♣️', '♦️'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        let deck = [];
        for (let s of suits) {
            for (let v of values) {
                deck.push({ s, v });
            }
        }
        return deck.sort(() => Math.random() - 0.5);
    }

    getScore(hand) {
        let score = 0;
        let aces = 0;
        for (let card of hand) {
            if (['J', 'Q', 'K'].includes(card.v)) score += 10;
            else if (card.v === 'A') {
                score += 11;
                aces++;
            } else score += parseInt(card.v);
        }
        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }
        return score;
    }

    deal(target) {
        const card = this.deck.pop();
        this.players[target].hand.push(card);
        this.players[target].score = this.getScore(this.players[target].hand);
    }
}

module.exports = Blackjack;
