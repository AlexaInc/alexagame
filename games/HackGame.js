/**
 * Hack Game Logic (Bulls and Cows style)
 * bot generates a PIN, user guesses using inline keyboard.
 * Hints: Correct position (Bulls), Correct digit but wrong position (Cows).
 */

class HackGame {
    constructor(length = 4, bet = 100) {
        this.length = length;
        this.bet = bet;
        this.target = this.generatePin(length);
        this.attempts = 0;
        this.maxAttempts = length + 3;
        this.currentGuess = "";
    }

    generatePin(length) {
        let pin = "";
        const digits = "0123456789";
        for (let i = 0; i < length; i++) {
            pin += digits[Math.floor(Math.random() * digits.length)];
        }
        return pin;
    }

    checkGuess(guess) {
        let bulls = 0;
        let cows = 0;
        const targetArr = this.target.split("");
        const guessArr = guess.split("");

        // Check bulls
        for (let i = 0; i < targetArr.length; i++) {
            if (targetArr[i] === guessArr[i]) {
                bulls++;
                targetArr[i] = null;
                guessArr[i] = null;
            }
        }

        // Check cows
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

module.exports = HackGame;
