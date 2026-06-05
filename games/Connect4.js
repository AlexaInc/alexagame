/**
 * Connect 4 — 8×8 inline button board
 * Gravity-based: pieces drop to lowest empty row
 * Win by getting 4 in a row (horizontal, vertical, diagonal)
 * 🔴 = player 1, 🟡 = player 2, . = empty
 */
class Connect4 {
    constructor(player1, bet) {
        this.players = [player1];
        this.names = {};
        this.bet = bet;
        this.size = 8;
        this.board = Array(this.size).fill(null).map(() => Array(this.size).fill(null));
        this.turn = 0;
        this.status = 'lobby';
    }

    addPlayer(player2) {
        if (this.players.length < 2) {
            this.players.push(player2);
            this.status = 'playing';
            return true;
        }
        return false;
    }

    setName(userId, name) { this.names[userId] = name; }
    getName(userId) { return this.names[userId] || 'Player'; }

    // In connect4, user taps any cell in a column — piece drops to bottom
    makeMove(userId, col) {
        if (this.status !== 'playing') return false;
        if (this.players[this.turn] !== userId) return false;
        if (col < 0 || col >= this.size) return false;
        // Find lowest empty row in this column
        for (let r = this.size - 1; r >= 0; r--) {
            if (this.board[r][col] === null) {
                this.board[r][col] = this.turn === 0 ? 'r' : 'y';
                this.turn = 1 - this.turn;
                return true;
            }
        }
        return false; // column full
    }

    checkWinner() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const p = this.board[r][c];
                if (!p) continue;
                if (c + 3 < this.size &&
                    p === this.board[r][c+1] && p === this.board[r][c+2] && p === this.board[r][c+3])
                    return this.players[p === 'r' ? 0 : 1];
                if (r + 3 < this.size &&
                    p === this.board[r+1][c] && p === this.board[r+2][c] && p === this.board[r+3][c])
                    return this.players[p === 'r' ? 0 : 1];
                if (r + 3 < this.size && c + 3 < this.size &&
                    p === this.board[r+1][c+1] && p === this.board[r+2][c+2] && p === this.board[r+3][c+3])
                    return this.players[p === 'r' ? 0 : 1];
                if (r + 3 < this.size && c - 3 >= 0 &&
                    p === this.board[r+1][c-1] && p === this.board[r+2][c-2] && p === this.board[r+3][c-3])
                    return this.players[p === 'r' ? 0 : 1];
            }
        }
        // Draw — top row full
        if (!this.board[0].includes(null)) return 'draw';
        return null;
    }

    cellEmoji(r, c) {
        const p = this.board[r][c];
        if (p === 'r') return '🔴';
        if (p === 'y') return '🟡';
        return '.';
    }
}

module.exports = Connect4;
