/**
 * Chess — Inline button based
 * White: ♔♕♖♗♘♙  |  Black: ♚♛♜♝♞♟
 * . = empty
 * Selected piece gets brackets: [♙] [♚] etc.
 * No move highlights — user taps destination, gets alert if invalid.
 */
class Chess {
    constructor(player1, bet) {
        this.players = [player1];
        this.bet = bet;
        this.board = this.initBoard();
        this.turn = 0;
        this.status = 'lobby';
        this.selected = null;
        this.validMoves = [];
        this.moveCount = 0;
    }

    initBoard() {
        return [
            ['br','bn','bb','bq','bk','bb','bn','br'],
            ['bp','bp','bp','bp','bp','bp','bp','bp'],
            [null,null,null,null,null,null,null,null],
            [null,null,null,null,null,null,null,null],
            [null,null,null,null,null,null,null,null],
            [null,null,null,null,null,null,null,null],
            ['wp','wp','wp','wp','wp','wp','wp','wp'],
            ['wr','wn','wb','wq','wk','wb','wn','wr'],
        ];
    }

    addPlayer(userId) {
        if (this.players.length < 2 && !this.players.includes(userId)) {
            this.players.push(userId);
            this.status = 'playing';
            return true;
        }
        return false;
    }

    color(r, c) { const p = this.board[r][c]; return p ? p[0] : null; }
    type(r, c) { const p = this.board[r][c]; return p ? p[1] : null; }
    isOwn(r, c) { return this.color(r, c) === (this.turn === 0 ? 'w' : 'b'); }
    isEnemy(r, c) { return this.color(r, c) === (this.turn === 0 ? 'b' : 'w'); }
    isEmpty(r, c) { return !this.board[r][c]; }
    inB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

    getMovesFor(r, c) {
        const moves = [];
        const p = this.board[r][c];
        if (!p) return moves;
        const t = p[1], own = p[0];

        const add = (nr, nc) => {
            if (!this.inB(nr, nc) || this.color(nr, nc) === own) return;
            moves.push({ r: nr, c: nc });
        };
        const slide = (dr, dc) => {
            let nr = r + dr, nc = c + dc;
            while (this.inB(nr, nc)) {
                if (this.color(nr, nc) === own) break;
                moves.push({ r: nr, c: nc });
                if (!this.isEmpty(nr, nc)) break;
                nr += dr; nc += dc;
            }
        };

        if (t === 'p') {
            const dir = own === 'w' ? -1 : 1;
            const start = own === 'w' ? 6 : 1;
            if (this.inB(r+dir, c) && this.isEmpty(r+dir, c)) {
                moves.push({ r: r+dir, c });
                if (r === start && this.isEmpty(r+dir*2, c)) moves.push({ r: r+dir*2, c });
            }
            for (const dc of [-1, 1])
                if (this.inB(r+dir, c+dc) && this.isEnemy(r+dir, c+dc))
                    moves.push({ r: r+dir, c: c+dc });
        }
        else if (t === 'n') {
            for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
                add(r+dr, c+dc);
        }
        else if (t === 'b') { slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1); }
        else if (t === 'r') { slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); }
        else if (t === 'q') { slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1); slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); }
        else if (t === 'k') {
            for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
                add(r+dr, c+dc);
        }
        return moves;
    }

    selectPiece(userId, r, c) {
        if (this.players[this.turn] !== userId) return { error: "Not your turn!" };
        if (!this.isOwn(r, c)) return { error: "Invalid selection!" };
        const moves = this.getMovesFor(r, c);
        if (moves.length === 0) return { error: "This piece has no moves!" };
        this.selected = { r, c };
        this.validMoves = moves;
        return { ok: true };
    }

    moveTo(r, c) {
        if (!this.selected) return { error: "Select a piece first!" };
        const move = this.validMoves.find(m => m.r === r && m.c === c);
        if (!move) return { error: "Invalid move!" };
        const captured = this.board[r][c];
        this.board[r][c] = this.board[this.selected.r][this.selected.c];
        this.board[this.selected.r][this.selected.c] = null;
        if (this.board[r][c] === 'wp' && r === 0) this.board[r][c] = 'wq';
        if (this.board[r][c] === 'bp' && r === 7) this.board[r][c] = 'bq';
        this.selected = null;
        this.validMoves = [];
        this.turn = 1 - this.turn;
        this.moveCount++;
        return { ok: true, captured };
    }

    deselect() { this.selected = null; this.validMoves = []; }

    checkWinner() {
        let wk = false, bk = false;
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c] === 'wk') wk = true;
                if (this.board[r][c] === 'bk') bk = true;
            }
        if (!wk) return this.players[1];
        if (!bk) return this.players[0];
        if (this.moveCount >= 200) return 'draw';
        return null;
    }

    static EMOJI = {
        'wk':'♔','wq':'♕','wr':'♖','wb':'♗','wn':'♘','wp':'♙',
        'bk':'♚','bq':'♛','br':'♜','bb':'♝','bn':'♞','bp':'♟'
    };

    cellEmoji(r, c) {
        const p = this.board[r][c];
        const isSel = this.selected && this.selected.r === r && this.selected.c === c;
        if (p) {
            const emoji = Chess.EMOJI[p] || '?';
            return isSel ? `[${emoji}]` : emoji;
        }
        return '.';
    }
}

module.exports = Chess;
