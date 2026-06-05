class CarromGame {
    constructor(bet, maxPlayers) {
        this.bet = bet;
        this.maxPlayers = maxPlayers || 4;
        this.players = []; this.turn = 0; this.scores = [];
        this.status = 'lobby'; this.size = 400; this.pad = 24;
        this.pieces = []; this.striker = null;
        this.pockets = [
            { x: this.pad, y: this.pad }, { x: this.size - this.pad, y: this.pad },
            { x: this.pad, y: this.size - this.pad }, { x: this.size - this.pad, y: this.size - this.pad },
        ];
        this.lastShot = null; this.lastEvent = null;
        this._timer = null; this._autoStart = null;
        this.chatId = null; this.hostId = null;
        this.blackPocketed = 0; this.whitePocketed = 0; this.queenPocketed = false;
    }
    addPlayer(userId, name) {
        if (this.players.length >= 4 || this.players.some(p => p.userId === userId)) return false;
        this.players.push({ userId, name }); this.scores.push(0);
        if (!this.hostId) this.hostId = userId; return true;
    }
    getTeam(i) { return i % 2; }
    getMyColor(i) { return this.getTeam(i) === 0 ? 'black' : 'white'; }
    start() { this.status = 'playing'; this.initPieces(); this.resetStriker(); this.lastShot = null; }
    initPieces() {
        const S = this.size, R = 9, cx = S / 2, cy = S / 2;
        this.pieces = [];
        this.pieces.push({ x: cx, y: cy, vx: 0, vy: 0, r: R, type: 'queen', pocketed: false });
        const innerR = R * 2.5;
        for (let i = 0; i < 6; i++) {
            const a = (Math.PI * 2 / 6) * i;
            this.pieces.push({ x: cx + Math.cos(a) * innerR, y: cy + Math.sin(a) * innerR, vx: 0, vy: 0, r: R, type: i % 2 === 0 ? 'white' : 'black', pocketed: false });
        }
        const outerR = R * 4.8;
        for (let i = 0; i < 12; i++) {
            const a = (Math.PI * 2 / 12) * i + Math.PI / 12;
            this.pieces.push({ x: cx + Math.cos(a) * outerR, y: cy + Math.sin(a) * outerR, vx: 0, vy: 0, r: R, type: i % 2 === 0 ? 'black' : 'white', pocketed: false });
        }
        this.striker = { x: S / 2, y: S - this.pad - 40, vx: 0, vy: 0, r: 12, type: 'striker', pocketed: false };
    }
    resetStriker() {
        if (!this.striker) return;
        this.striker.pocketed = false; this.striker.vx = 0; this.striker.vy = 0;
        this.striker.x = this.size / 2;
        this.striker.y = this.turn % 2 === 0 ? this.size - this.pad - 40 : this.pad + 40;
    }
    moveStriker(userId, x) {
        if (this.status !== 'playing') return { error: 'Not active' };
        if (!this.players[this.turn] || this.players[this.turn].userId !== userId) return { error: 'Not your turn' };
        if (!this.striker) return { error: 'No striker' };
        this.striker.x = Math.max(this.pad + 50, Math.min(this.size - this.pad - 50, x));
        return { ok: true };
    }
    shoot(userId, vx, vy) {
        if (this.status !== 'playing') return { error: 'Game not active' };
        if (!this.players[this.turn] || this.players[this.turn].userId !== userId) return { error: 'Not your turn' };
        if (!this.striker) return { error: 'No striker' };
        const mag = Math.sqrt(vx * vx + vy * vy);
        if (mag < 0.5) return { error: 'Too weak' };
        const maxP = 40;
        if (mag > maxP) { vx = (vx / mag) * maxP; vy = (vy / mag) * maxP; }
        this.lastShot = { vx, vy, strikerX: this.striker.x, strikerY: this.striker.y };
        this.striker.vx = vx; this.striker.vy = vy;
        this.simulate();
        return { ok: true };
    }
    simulate() {
        const FR = 0.992, MV = 0.1;
        const POCKET_CATCH = 28;  // gravity pull radius
        const POCKET_SINK = 16;   // instant sink radius
        const POCKET_PULL = 0.8;  // pull strength
        let pocketedThisTurn = [];

        for (let step = 0; step < 4000; step++) {
            let moving = false;
            const all = [...this.pieces.filter(p => !p.pocketed)];
            if (this.striker && !this.striker.pocketed) all.push(this.striker);
            for (const d of all) {
                d.x += d.vx; d.y += d.vy; d.vx *= FR; d.vy *= FR;
                if (Math.abs(d.vx) < MV && Math.abs(d.vy) < MV) { d.vx = 0; d.vy = 0; } else moving = true;

                // Pocket: gravity pull + sink
                let sunk = false;
                for (const pk of this.pockets) {
                    const dx = pk.x - d.x, dy = pk.y - d.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < POCKET_SINK) {
                        d.pocketed = true; d.vx = 0; d.vy = 0; pocketedThisTurn.push(d.type); sunk = true; break;
                    } else if (dist < POCKET_CATCH) {
                        // Pull toward pocket center (gravity effect)
                        const pull = POCKET_PULL * (1 - dist / POCKET_CATCH);
                        d.vx += (dx / dist) * pull;
                        d.vy += (dy / dist) * pull;
                    }
                }
                if (sunk) continue;
                // Walls
                if (d.x - d.r < this.pad) { d.x = this.pad + d.r; d.vx = Math.abs(d.vx) * 0.5; }
                if (d.x + d.r > this.size - this.pad) { d.x = this.size - this.pad - d.r; d.vx = -Math.abs(d.vx) * 0.5; }
                if (d.y - d.r < this.pad) { d.y = this.pad + d.r; d.vy = Math.abs(d.vy) * 0.5; }
                if (d.y + d.r > this.size - this.pad) { d.y = this.size - this.pad - d.r; d.vy = -Math.abs(d.vy) * 0.5; }
            }
            for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
                const a = all[i], b = all[j]; if (a.pocketed || b.pocketed) continue;
                const dx = b.x - a.x, dy = b.y - a.y, dist = Math.sqrt(dx * dx + dy * dy), minD = a.r + b.r;
                if (dist < minD && dist > 0) {
                    const ov = (minD - dist) / 2, nx = dx / dist, ny = dy / dist;
                    a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
                    const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
                    if (dvn > 0) { a.vx -= dvn * nx; a.vy -= dvn * ny; b.vx += dvn * nx; b.vy += dvn * ny; }
                }
            }
            if (!moving) break;
        }
        const myColor = this.getMyColor(this.turn);
        let scoredOwn = 0, foul = false, queen = false;
        for (const t of pocketedThisTurn) { if (t === 'striker') foul = true; else if (t === 'queen') queen = true; else if (t === myColor) scoredOwn++; }
        if (foul) { this.scores[this.turn] = Math.max(0, this.scores[this.turn] - 1); this.lastEvent = { text: '⚠️ Foul! -1' }; }
        else if (queen) { this.scores[this.turn] += 3; this.lastEvent = { text: '👑 Queen! +3' }; }
        this.scores[this.turn] += scoredOwn;
        if (scoredOwn > 0 && !foul) this.lastEvent = { text: `🎯 +${scoredOwn}! Continue!` };
        else if (!foul && !queen && scoredOwn === 0) this.lastEvent = null;
        this.blackPocketed = this.pieces.filter(p => p.type === 'black' && p.pocketed).length;
        this.whitePocketed = this.pieces.filter(p => p.type === 'white' && p.pocketed).length;
        this.queenPocketed = this.pieces.some(p => p.type === 'queen' && p.pocketed);
        if (9 - this.blackPocketed === 0 || 9 - this.whitePocketed === 0) { this.status = 'ended'; return; }
        if (scoredOwn > 0 && !foul) { /* keep turn */ } else { this.turn = (this.turn + 1) % this.players.length; }
        this.resetStriker();
    }
    getWinner() { if (this.status !== 'ended') return null; if (9 - this.blackPocketed === 0) return 0; if (9 - this.whitePocketed === 0) return 1; let mx = -1, wi = 0; this.scores.forEach((s, i) => { if (s > mx) { mx = s; wi = i; } }); return this.getTeam(wi); }
    getWinnerPlayers() { const wt = this.getWinner(); if (wt === null) return []; return this.players.filter((_, i) => this.getTeam(i) === wt); }
    getState(forUserId) {
        const pi = this.players.findIndex(p => p.userId === forUserId);
        return { status: this.status, players: this.players.map((p, i) => ({ name: p.name, score: this.scores[i], isMe: p.userId === forUserId, color: this.getMyColor(i), team: this.getTeam(i) })),
            turn: this.turn, currentPlayer: this.players[this.turn]?.name || '?', isMyTurn: this.players[this.turn]?.userId === forUserId,
            isHost: this.hostId === forUserId, playerIdx: pi, playerCount: this.players.length, myColor: pi >= 0 ? this.getMyColor(pi) : null,
            pieces: this.pieces.map(p => ({ x: p.x, y: p.y, r: p.r, type: p.type, pocketed: p.pocketed })),
            striker: this.striker ? { x: this.striker.x, y: this.striker.y, r: this.striker.r, pocketed: this.striker.pocketed } : null,
            lastShot: this.lastShot, lastEvent: this.lastEvent, winner: this.status === 'ended' ? this.getWinner() : null,
            winnerPlayers: this.status === 'ended' ? this.getWinnerPlayers().map(p => p.name) : [],
            blackLeft: 9 - this.blackPocketed, whiteLeft: 9 - this.whitePocketed, queenPocketed: this.queenPocketed, size: this.size, pad: this.pad };
    }
}
module.exports = CarromGame;
