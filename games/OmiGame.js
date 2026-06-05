/**
 * Omi Card Game — Trick-taking game
 * 
 * Rules:
 * - 2 or 4 players (4 = 2v2 teams, partners sit opposite)
 * - 32 cards: 7,8,9,10,J,Q,K,A × ♠♥♦♣
 * - 8 cards dealt to each player (2p) or 8 each (4p)
 * - Trump suit chosen by first player
 * - Must follow lead suit if possible
 * - Highest card of lead suit wins (trump beats all)
 * - Team with more tricks wins
 */
class OmiGame {
    constructor(bet) {
        this.bet = bet;
        this.players = []; // [{userId, name}]
        this.status = 'lobby'; // lobby, chooseTrump, playing, ended
        this.hands = {};     // {userId: [{label, val, suit}]}
        this.trump = null;   // suit chosen as trump
        this.tricks = {};    // {userId: count}
        this.currentTrick = []; // [{userId, card:{label,val,suit}}]
        this.leadPlayer = 0; // index of who leads
        this.turn = 0;
        this.round = 0;
        this.totalTricks = 0;
        this.hostId = null;
        this.chatId = null;
        this._timer = null;
        this._autoStart = null;
    }

    addPlayer(userId, name) {
        if (this.players.length >= 4 || this.players.some(p => p.userId === userId)) return false;
        this.players.push({ userId, name });
        this.tricks[userId] = 0;
        if (!this.hostId) this.hostId = userId;
        return true;
    }

    getTeam(i) { return i % 2; }

    start() {
        if (this.players.length < 2) return false;
        // 3 players: kick last
        if (this.players.length === 3) { this.players.pop(); }
        this.deal();
        this.status = 'chooseTrump';
        this.turn = 0;
        return true;
    }

    deal() {
        const suits = ['♠', '♥', '♦', '♣'];
        const labels = ['7','8','9','10','J','Q','K','A'];
        const valMap = {'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
        const deck = [];
        for (const s of suits) for (const l of labels) deck.push({ label: l, val: valMap[l], suit: s });
        // Shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        // Deal
        const n = this.players.length;
        const cardsPerPlayer = Math.floor(32 / n);
        this.hands = {};
        let idx = 0;
        for (const p of this.players) {
            this.hands[p.userId] = [];
            for (let i = 0; i < cardsPerPlayer; i++) {
                this.hands[p.userId].push(deck[idx++]);
            }
            // Sort by suit then value
            this.hands[p.userId].sort((a, b) => {
                if (a.suit !== b.suit) return suits.indexOf(a.suit) - suits.indexOf(b.suit);
                return a.val - b.val;
            });
        }
        this.totalTricks = cardsPerPlayer;
        this.round = 0;
    }

    chooseTrump(userId, suit) {
        if (this.status !== 'chooseTrump') return { error: 'Not choosing trump' };
        if (this.players[0].userId !== userId) return { error: 'Only first player chooses trump' };
        if (!['♠','♥','♦','♣'].includes(suit)) return { error: 'Invalid suit' };
        this.trump = suit;
        this.status = 'playing';
        this.turn = 0;
        this.leadPlayer = 0;
        return { ok: true };
    }

    playCard(userId, cardIndex) {
        if (this.status !== 'playing') return { error: 'Not playing' };
        const cp = this.players[this.turn];
        if (!cp || cp.userId !== userId) return { error: 'Not your turn' };
        const hand = this.hands[userId];
        if (!hand || cardIndex < 0 || cardIndex >= hand.length) return { error: 'Invalid card' };

        const card = hand[cardIndex];

        // Must follow lead suit if possible
        if (this.currentTrick.length > 0) {
            const leadSuit = this.currentTrick[0].card.suit;
            const hasSuit = hand.some(c => c.suit === leadSuit);
            if (hasSuit && card.suit !== leadSuit) {
                return { error: `Must follow ${leadSuit}!` };
            }
        }

        // Play the card
        hand.splice(cardIndex, 1);
        this.currentTrick.push({ userId, card });
        this.turn = (this.turn + 1) % this.players.length;

        // If all players played, resolve trick
        if (this.currentTrick.length >= this.players.length) {
            this.resolveTrick();
        }

        return { ok: true };
    }

    resolveTrick() {
        const leadSuit = this.currentTrick[0].card.suit;
        let winnerId = this.currentTrick[0].userId;
        let winCard = this.currentTrick[0].card;

        for (let i = 1; i < this.currentTrick.length; i++) {
            const { userId, card } = this.currentTrick[i];
            // Trump beats non-trump
            if (card.suit === this.trump && winCard.suit !== this.trump) {
                winnerId = userId; winCard = card;
            } else if (card.suit === winCard.suit && card.val > winCard.val) {
                winnerId = userId; winCard = card;
            }
        }

        this.tricks[winnerId] = (this.tricks[winnerId] || 0) + 1;
        this.round++;

        // Winner leads next trick
        this.leadPlayer = this.players.findIndex(p => p.userId === winnerId);
        this.turn = this.leadPlayer;

        // Store last trick for display
        this.lastTrick = {
            plays: this.currentTrick.map(t => ({
                name: this.players.find(p => p.userId === t.userId)?.name,
                card: t.card,
                isWinner: t.userId === winnerId
            })),
            winnerName: this.players.find(p => p.userId === winnerId)?.name
        };

        this.currentTrick = [];

        // Check if game over
        if (this.round >= this.totalTricks) {
            this.status = 'ended';
        }
    }

    getWinners() {
        const n = this.players.length;
        if (n === 2) {
            // Most tricks wins
            const p0 = this.tricks[this.players[0].userId] || 0;
            const p1 = this.tricks[this.players[1].userId] || 0;
            if (p0 > p1) return [this.players[0]];
            if (p1 > p0) return [this.players[1]];
            return this.players; // draw
        }
        // 4 players: teams
        const team0 = (this.tricks[this.players[0]?.userId] || 0) + (this.tricks[this.players[2]?.userId] || 0);
        const team1 = (this.tricks[this.players[1]?.userId] || 0) + (this.tricks[this.players[3]?.userId] || 0);
        if (team0 > team1) return [this.players[0], this.players[2]].filter(Boolean);
        if (team1 > team0) return [this.players[1], this.players[3]].filter(Boolean);
        return this.players;
    }

    getState(forUserId) {
        const pi = this.players.findIndex(p => p.userId === forUserId);
        const myHand = (this.hands[forUserId] || []).map((c, i) => ({
            label: c.label, suit: c.suit, val: c.val, index: i
        }));

        // Current trick cards
        const trickCards = this.currentTrick.map(t => ({
            name: this.players.find(p => p.userId === t.userId)?.name,
            card: { label: t.card.label, suit: t.card.suit },
            isMe: t.userId === forUserId
        }));

        // Trick counts
        const trickCounts = {};
        for (const p of this.players) trickCounts[p.name] = this.tricks[p.userId] || 0;

        return {
            status: this.status,
            players: this.players.map((p, i) => ({
                name: p.name, isMe: p.userId === forUserId,
                tricks: this.tricks[p.userId] || 0,
                team: this.getTeam(i),
                cardCount: (this.hands[p.userId] || []).length,
                hasPlayed: this.currentTrick.some(t => t.userId === p.userId)
            })),
            turn: this.turn,
            currentPlayer: this.players[this.turn]?.name || '?',
            isMyTurn: this.players[this.turn]?.userId === forUserId,
            isHost: this.hostId === forUserId,
            playerIdx: pi,
            playerCount: this.players.length,
            myHand,
            trump: this.trump,
            trickCards,
            lastTrick: this.lastTrick || null,
            round: this.round,
            totalTricks: this.totalTricks,
            winner: this.status === 'ended' ? this.getWinners().map(p => p.name) : null,
        };
    }
}

module.exports = OmiGame;
