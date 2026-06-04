class TicTacToe {
    constructor(player1, bet) {
        this.players = [player1]; // [X, O]
        this.bet = bet;
        this.board = Array(9).fill(null);
        this.turn = 0; // index of players
        this.status = 'lobby'; // lobby, playing, finished
    }

    addPlayer(player2) {
        if (this.players.length < 2) {
            this.players.push(player2);
            this.status = 'playing';
            return true;
        }
        return false;
    }

    makeMove(userId, index) {
        if (this.status !== 'playing') return false;
        if (this.players[this.turn] !== userId) return false;
        if (this.board[index] !== null) return false;

        this.board[index] = this.turn === 0 ? '❌' : '⭕';
        this.turn = 1 - this.turn;
        return true;
    }

    checkWinner() {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        for (let line of lines) {
            const [a, b, c] = line;
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                return this.board[a] === '❌' ? this.players[0] : this.players[1];
            }
        }
        if (!this.board.includes(null)) return 'draw';
        return null;
    }
}

module.exports = TicTacToe;
