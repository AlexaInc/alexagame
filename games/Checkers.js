/**
 * Checkers — Inline button based with multi-jump and flying kings
 * 
 * Regular pieces: move forward only, BUT can capture both forward AND backward
 * Kings: move and capture any direction, any distance (flying kings)
 * Forced capture rule: if you can capture, you MUST
 * Multi-jump: if after capturing you can capture again, you MUST continue
 */
class Checkers {
    constructor(player1, bet) {
        this.players = [player1];
        this.bet = bet;
        this.board = this.initBoard();
        this.turn = 0;
        this.status = 'lobby';
        this.selected = null;
        this.validMoves = [];
        this.mustContinueFrom = null;
    }

    initBoard() {
        const b = Array(8).fill(null).map(() => Array(8).fill(null));
        for (let r = 0; r < 3; r++)
            for (let c = 0; c < 8; c++)
                if ((r + c) % 2 === 1) b[r][c] = 'b';
        for (let r = 5; r < 8; r++)
            for (let c = 0; c < 8; c++)
                if ((r + c) % 2 === 1) b[r][c] = 'w';
        return b;
    }

    addPlayer(userId) {
        if (this.players.length < 2 && !this.players.includes(userId)) {
            this.players.push(userId);
            this.status = 'playing';
            return true;
        }
        return false;
    }

    isOwn(r, c) {
        const p = this.board[r][c];
        if (!p) return false;
        return this.turn === 0 ? (p === 'w' || p === 'W') : (p === 'b' || p === 'B');
    }

    isEnemy(r, c) {
        const p = this.board[r][c];
        if (!p) return false;
        return this.turn === 0 ? (p === 'b' || p === 'B') : (p === 'w' || p === 'W');
    }

    isKing(r, c) { return this.board[r][c] === 'W' || this.board[r][c] === 'B'; }

    isOwnPiece(color, cell) {
        const c = color.toLowerCase();
        if (c === 'w') return cell === 'w' || cell === 'W';
        return cell === 'b' || cell === 'B';
    }

    isEnemyPiece(color, cell) {
        const c = color.toLowerCase();
        if (c === 'w') return cell === 'b' || cell === 'B';
        return cell === 'w' || cell === 'W';
    }

    // Get captures for a piece — regular pieces can capture BOTH directions
    getCapturesFor(r, c) {
        const caps = [];
        const piece = this.board[r][c];
        if (!piece) return caps;
        const king = this.isKing(r, c);

        if (king) {
            // Flying king: scan all 4 diagonals for enemy with empty behind
            for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
                let nr = r + dr, nc = c + dc;
                let foundEnemy = null;
                while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
                    const cell = this.board[nr][nc];
                    if (cell) {
                        if (this.isOwnPiece(piece[0], cell)) break;
                        if (foundEnemy) break;
                        if (this.isEnemyPiece(piece[0], cell)) foundEnemy = { r: nr, c: nc };
                    } else if (foundEnemy) {
                        caps.push({ r: nr, c: nc, cr: foundEnemy.r, cc: foundEnemy.c });
                    }
                    nr += dr; nc += dc;
                }
            }
        } else {
            // Regular piece: can capture in ALL 4 diagonal directions (2 squares)
            // (Forward-only restriction is for MOVES, not captures)
            for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
                const mr = r + dr, mc = c + dc;
                const jr = r + dr * 2, jc = c + dc * 2;
                if (jr < 0 || jr > 7 || jc < 0 || jc > 7) continue;
                if (mr < 0 || mr > 7 || mc < 0 || mc > 7) continue;
                if (this.isEnemy(mr, mc) && !this.board[jr][jc])
                    caps.push({ r: jr, c: jc, cr: mr, cc: mc });
            }
        }
        return caps;
    }

    // Get all moves for a piece
    getMovesFor(r, c) {
        const piece = this.board[r][c];
        if (!piece) return [];
        const king = this.isKing(r, c);

        // Captures first (forced)
        const caps = this.getCapturesFor(r, c);
        if (caps.length > 0) return caps;

        // Normal moves
        const moves = [];
        if (king) {
            // Flying king: slide any direction any distance
            for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
                let nr = r + dr, nc = c + dc;
                while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
                    if (this.board[nr][nc]) break;
                    moves.push({ r: nr, c: nc, cr: null, cc: null });
                    nr += dr; nc += dc;
                }
            }
        } else {
            // Regular piece: move FORWARD only (white goes up, black goes down)
            const dirs = piece === 'w' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
            for (const [dr, dc] of dirs) {
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
                if (!this.board[nr][nc])
                    moves.push({ r: nr, c: nc, cr: null, cc: null });
            }
        }
        return moves;
    }

    hasAnyCapture() {
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++)
                if (this.isOwn(r, c) && this.getCapturesFor(r, c).length > 0)
                    return true;
        return false;
    }

    selectPiece(userId, r, c) {
        if (this.players[this.turn] !== userId) return { error: "Not your turn!" };
        if (!this.isOwn(r, c)) return { error: "Invalid selection!" };

        if (this.mustContinueFrom) {
            if (r !== this.mustContinueFrom.r || c !== this.mustContinueFrom.c)
                return { error: "You must continue jumping with the same piece!" };
        }

        const moves = this.getMovesFor(r, c);

        if (!this.mustContinueFrom && this.hasAnyCapture() && !moves.some(m => m.cr !== null))
            return { error: "You must capture! Select a piece that can jump." };

        if (moves.length === 0) return { error: "No moves available for this piece!" };
        this.selected = { r, c };
        this.validMoves = moves;
        return { ok: true };
    }

    moveTo(r, c) {
        if (!this.selected) return { error: "Select a piece first!" };
        const move = this.validMoves.find(m => m.r === r && m.c === c);
        if (!move) return { error: "Invalid move!" };

        this.board[r][c] = this.board[this.selected.r][this.selected.c];
        this.board[this.selected.r][this.selected.c] = null;
        if (move.cr !== null) this.board[move.cr][move.cc] = null;

        // Promote
        if (this.board[r][c] === 'w' && r === 0) this.board[r][c] = 'W';
        if (this.board[r][c] === 'b' && r === 7) this.board[r][c] = 'B';

        this.selected = null;
        this.validMoves = [];

        // Chain capture
        if (move.cr !== null) {
            const moreCaps = this.getCapturesFor(r, c);
            if (moreCaps.length > 0) {
                this.mustContinueFrom = { r, c };
                this.selected = { r, c };
                this.validMoves = moreCaps;
                return { ok: true, captured: true, chainContinue: true };
            }
        }

        this.mustContinueFrom = null;
        this.turn = 1 - this.turn;
        return { ok: true, captured: move.cr !== null, chainContinue: false };
    }

    deselect() {
        if (this.mustContinueFrom) return false;
        this.selected = null;
        this.validMoves = [];
        return true;
    }

    checkWinner() {
        let w = 0, b = 0;
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p === 'w' || p === 'W') w++;
                if (p === 'b' || p === 'B') b++;
            }
        if (w === 0) return this.players[1];
        if (b === 0) return this.players[0];
        let hasMoves = false;
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++)
                if (this.isOwn(r, c) && this.getMovesFor(r, c).length > 0) hasMoves = true;
        if (!hasMoves) return this.players[1 - this.turn];
        return null;
    }

    cellEmoji(r, c) {
        const p = this.board[r][c];
        const isSel = this.selected && this.selected.r === r && this.selected.c === c;
        if (isSel) {
            if (p === 'w') return '[⚪]';
            if (p === 'W') return '[◻]';
            if (p === 'b') return '[⚫]';
            if (p === 'B') return '[◼]';
        }
        if (p === 'w') return '⚪';
        if (p === 'W') return '◻';
        if (p === 'b') return '⚫';
        if (p === 'B') return '◼';
        return '.';
    }
}

module.exports = Checkers;
