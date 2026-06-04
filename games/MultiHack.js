class MultiHack {
    constructor(creatorId, minBet, length) {
        this.creatorId = creatorId;
        this.minBet = minBet;
        this.length = length;
        this.players = [creatorId];
        this.status = 'lobby'; // lobby, playing, finished
        this.target = this.generatePin(length);
        this.turnIndex = 0;
        this.history = [];
        this.startTime = Date.now();
        this.timer = null;
    }

    generatePin(length) {
        let pin = "";
        const digits = "0123456789";
        for (let i = 0; i < length; i++) {
            pin += digits[Math.floor(Math.random() * digits.length)];
        }
        return pin;
    }

    addPlayer(userId) {
        if (!this.players.includes(userId)) {
            this.players.push(userId);
            return true;
        }
        return false;
    }

    getCurrentPlayer() {
        return this.players[this.turnIndex];
    }

    nextTurn() {
        this.turnIndex = (this.turnIndex + 1) % this.players.length;
    }

    checkGuess(guess) {
        let bulls = 0;
        let cows = 0;
        const targetArr = this.target.split("");
        const guessArr = guess.split("");

        for (let i = 0; i < targetArr.length; i++) {
            if (targetArr[i] === guessArr[i]) {
                bulls++;
                targetArr[i] = null;
                guessArr[i] = null;
            }
        }

        for (let i = 0; i < guessArr.length; i++) {
            if (guessArr[i] !== null) {
                const index = targetArr.indexOf(guessArr[i]);
                if (index !== -1) {
                    cows++;
                    targetArr[index] = null;
                }
            }
        }
        return { bulls, cows };
    }
}

module.exports = MultiHack;
