/**
 * Tic-Tac-Toe — 8×8 inline button board
 * Win by getting 4 in a row (horizontal, vertical, diagonal)
 * ❌ = player 1, ⭕ = player 2, . = empty
 */
class TicTacToe {
    constructor(player1, bet) {
        this.players = [player1];
        this.names = {};
        this.bet = bet;
        this.size = 8;
        this.board = Array(this.size).fill(null).map(() => Array(this.size).fill(null));
        this.turn = 0;
        this.status = 'lobby';
        this.lastMove = null;
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

    makeMove(userId, r, c) {
        if (this.status !== 'playing') return false;
        if (this.players[this.turn] !== userId) return false;
        if (r < 0 || r >= this.size || c < 0 || c >= this.size) return false;
        if (this.board[r][c] !== null) return false;
        this.board[r][c] = this.turn === 0 ? 'x' : 'o';
        this.lastMove = { r, c };
        this.turn = 1 - this.turn;
        return true;
    }

    checkWinner() {
        // Check for 4 in a row
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const p = this.board[r][c];
                if (!p) continue;
                // Right
                if (c + 3 < this.size &&
                    p === this.board[r][c+1] && p === this.board[r][c+2] && p === this.board[r][c+3])
                    return this.players[p === 'x' ? 0 : 1];
                // Down
                if (r + 3 < this.size &&
                    p === this.board[r+1][c] && p === this.board[r+2][c] && p === this.board[r+3][c])
                    return this.players[p === 'x' ? 0 : 1];
                // Diagonal down-right
                if (r + 3 < this.size && c + 3 < this.size &&
                    p === this.board[r+1][c+1] && p === this.board[r+2][c+2] && p === this.board[r+3][c+3])
                    return this.players[p === 'x' ? 0 : 1];
                // Diagonal down-left
                if (r + 3 < this.size && c - 3 >= 0 &&
                    p === this.board[r+1][c-1] && p === this.board[r+2][c-2] && p === this.board[r+3][c-3])
                    return this.players[p === 'x' ? 0 : 1];
            }
        }
        // Draw — all cells filled
        let empty = false;
        for (let r = 0; r < this.size; r++)
            for (let c = 0; c < this.size; c++)
                if (!this.board[r][c]) empty = true;
        if (!empty) return 'draw';
        return null;
    }

    cellEmoji(r, c) {
        const p = this.board[r][c];
        if (p === 'x') return '❌';
        if (p === 'o') return '⭕';
        return '.';
    }
}

module.exports = TicTacToe;
