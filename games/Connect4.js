class Connect4 {
    constructor(player1, bet) {
        this.players = [player1];
        this.bet = bet;
        this.rows = 6;
        this.cols = 7;
        this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(null));
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

    makeMove(userId, col) {
        if (this.status !== 'playing') return false;
        if (this.players[this.turn] !== userId) return false;
        if (col < 0 || col >= this.cols) return false;

        for (let r = this.rows - 1; r >= 0; r--) {
            if (this.board[r][col] === null) {
                this.board[r][col] = this.turn === 0 ? '🔴' : '🟡';
                this.turn = 1 - this.turn;
                return true;
            }
        }
        return false;
    }

    checkWinner() {
        const b = this.board;
        // Horizontal, Vertical, Diagonal checks
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const p = b[r][c];
                if (!p) continue;
                // Right
                if (c + 3 < this.cols && p === b[r][c+1] && p === b[r][c+2] && p === b[r][c+3]) return this.players[p === '🔴' ? 0 : 1];
                // Down
                if (r + 3 < this.rows && p === b[r+1][c] && p === b[r+2][c] && p === b[r+3][c]) return this.players[p === '🔴' ? 0 : 1];
                // Diagonal Down-Right
                if (r + 3 < this.rows && c + 3 < this.cols && p === b[r+1][c+1] && p === b[r+2][c+2] && p === b[r+3][c+3]) return this.players[p === '🔴' ? 0 : 1];
                // Diagonal Down-Left
                if (r + 3 < this.rows && c - 3 >= 0 && p === b[r+1][c-1] && p === b[r+2][c-2] && p === b[r+3][c-3]) return this.players[p === '🔴' ? 0 : 1];
            }
        }
        if (!this.board[0].includes(null)) return 'draw';
        return null;
    }
}

module.exports = Connect4;
