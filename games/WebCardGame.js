/**
 * Web Card Game — Server-side state for Mini App
 * Classic card flip: each player has 4 cards, play 1 per round, highest wins
 * 4 rounds total, most round wins = game winner
 */
class WebCardGame {
    constructor(bet) {
        this.bet = bet;
        this.players = []; // [{userId, name}]
        this.status = 'lobby'; // lobby, playing, reveal, ended
        this.hands = {};   // {userId: [{label, val, suit, played}]}
        this.round = 0;
        this.roundPlays = {}; // {userId: {label, val, suit}}
        this.roundResults = []; // [{winner, plays}]
        this.scores = {};  // {userId: roundsWon}
        this.hostId = null;
        this.chatId = null;
        this._timer = null;
        this._autoStart = null;
        this._revealTimer = null;
    }

    addPlayer(userId, name) {
        if (this.players.length >= 6 || this.players.some(p => p.userId === userId)) return false;
        this.players.push({ userId, name });
        this.scores[userId] = 0;
        if (!this.hostId) this.hostId = userId;
        return true;
    }

    start() {
        if (this.players.length < 2) return false;
        this.status = 'playing';
        this.round = 1;
        this.dealCards();
        return true;
    }

    dealCards() {
        const suits = ['♠', '♥', '♦', '♣'];
        const labels = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        const valMap = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};

        // Build a deck
        const deck = [];
        for (const s of suits)
            for (const l of labels)
                deck.push({ label: l, val: valMap[l], suit: s, played: false });

        // Shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        // Deal 4 cards to each player
        this.hands = {};
        let idx = 0;
        for (const p of this.players) {
            this.hands[p.userId] = [];
            for (let i = 0; i < 4; i++) {
                this.hands[p.userId].push(deck[idx++]);
            }
        }
        this.roundPlays = {};
    }

    playCard(userId, cardIndex) {
        if (this.status !== 'playing') return { error: 'Game not active' };
        if (this.roundPlays[userId]) return { error: 'Already played this round' };
        const hand = this.hands[userId];
        if (!hand) return { error: 'Not in game' };
        if (cardIndex < 0 || cardIndex >= hand.length) return { error: 'Invalid card' };
        if (hand[cardIndex].played) return { error: 'Card already used' };

        hand[cardIndex].played = true;
        this.roundPlays[userId] = {
            label: hand[cardIndex].label,
            val: hand[cardIndex].val,
            suit: hand[cardIndex].suit,
            cardIndex
        };

        // Check if all players have played
        if (Object.keys(this.roundPlays).length >= this.players.length) {
            this.resolveRound();
        }

        return { ok: true };
    }

    resolveRound() {
        this.status = 'reveal';

        // Find highest card
        let maxVal = -1, winners = [];
        for (const [uid, play] of Object.entries(this.roundPlays)) {
            if (play.val > maxVal) { maxVal = play.val; winners = [uid]; }
            else if (play.val === maxVal) { winners.push(uid); }
        }

        for (const w of winners) this.scores[w] = (this.scores[w] || 0) + 1;

        this.roundResults.push({
            round: this.round,
            plays: { ...this.roundPlays },
            winners
        });

        // Auto-advance after reveal delay (handled by client polling)
        this.round++;
        if (this.round > 4) {
            this.status = 'ended';
        }
    }

    nextRound() {
        if (this.status === 'reveal') {
            this.status = 'playing';
            this.roundPlays = {};
        }
    }

    // A player gives up; the remaining players win regardless of score.
    forfeit(userId) {
        if (this.status === 'ended') return { error: 'Game already ended' };
        const quitter = this.players.find(p => p.userId === userId);
        if (!quitter) return { error: 'Not in this game' };
        this.forfeitedBy = quitter.name;
        this.forfeitWinners = this.players.filter(p => p.userId !== userId);
        this.status = 'ended';
        return { ok: true };
    }

    getWinners() {
        // If a player gave up, the rest win.
        if (this.forfeitWinners) return this.forfeitWinners;
        let maxScore = -1, winners = [];
        for (const p of this.players) {
            const s = this.scores[p.userId] || 0;
            if (s > maxScore) { maxScore = s; winners = [p]; }
            else if (s === maxScore) { winners.push(p); }
        }
        return winners;
    }

    getState(forUserId) {
        const myHand = this.hands[forUserId]?.map((c, i) => ({
            label: c.label, suit: c.suit, val: c.val, played: c.played, index: i
        })) || [];

        // Other players' played cards: show face-down until reveal
        const tablePlays = {};
        for (const [uid, play] of Object.entries(this.roundPlays)) {
            if (this.status === 'reveal' || this.status === 'ended') {
                tablePlays[uid] = { label: play.label, suit: play.suit, val: play.val, faceUp: true };
            } else {
                tablePlays[uid] = { faceUp: false }; // face down
            }
        }

        const lastResult = this.roundResults.length > 0 ? this.roundResults[this.roundResults.length - 1] : null;
        let lastResultFormatted = null;
        if (lastResult) {
            lastResultFormatted = {
                round: lastResult.round,
                plays: {},
                winnerNames: lastResult.winners.map(uid => this.players.find(p => p.userId === uid)?.name || '?')
            };
            for (const [uid, play] of Object.entries(lastResult.plays)) {
                const pName = this.players.find(p => p.userId === uid)?.name || '?';
                lastResultFormatted.plays[pName] = { label: play.label, suit: play.suit };
            }
        }

        return {
            status: this.status,
            players: this.players.map(p => ({
                name: p.name,
                isMe: p.userId === forUserId,
                score: this.scores[p.userId] || 0,
                hasPlayed: !!this.roundPlays[p.userId]
            })),
            round: this.round,
            totalRounds: 4,
            myHand,
            iPlayed: !!this.roundPlays[forUserId],
            tablePlays,
            lastResult: lastResultFormatted,
            isHost: this.hostId === forUserId,
            winner: this.status === 'ended' ? this.getWinners().map(p => p.name) : null,
            playerCount: this.players.length,
            forfeitedBy: this.forfeitedBy || null,
            inGame: this.players.some(p => p.userId === forUserId),
        };
    }
}

module.exports = WebCardGame;
