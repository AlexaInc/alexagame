const express = require('express');
const crypto = require('crypto');
const path = require('path');
const User = require('./models/User');

const app = express();
app.use(express.json());

// ── CORS ──
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.WEBAPP_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Init-Data');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// ── Static files ──
app.use(express.static(path.join(__dirname, 'webapp')));
app.get('/carrom', (req, res) => res.sendFile(path.join(__dirname, 'webapp', 'carrom.html')));
app.get('/cards', (req, res) => res.sendFile(path.join(__dirname, 'webapp', 'cards.html')));
app.get('/omi', (req, res) => res.sendFile(path.join(__dirname, 'webapp', 'omi.html')));

// ── Auth ──
function verifyInitData(raw) {
    try {
        const params = new URLSearchParams(raw);
        const hash = params.get('hash'); if (!hash) return null;
        params.delete('hash');
        const cs = [...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
        const secret = crypto.createHmac('sha256','WebAppData').update(process.env.BOT_TOKEN).digest();
        if (crypto.createHmac('sha256',secret).update(cs).digest('hex') !== hash) return null;
        return JSON.parse(params.get('user') || 'null');
    } catch { return null; }
}

function auth(req, res, next) {
    const raw = req.headers['x-init-data'] || req.query.initData;
    if (!raw) return res.status(401).json({ ok: false, error: 'Missing auth' });
    const user = verifyInitData(raw);
    if (!user) return res.status(403).json({ ok: false, error: 'Invalid auth' });
    req.tgUser = user; next();
}

// ── Helper: DB query with timeout ──
async function dbFind(query, timeout = 5000) {
    return Promise.race([
        User.findOne(query).lean(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), timeout))
    ]);
}

// ── Helper: getName with timeout (won't hang server) ──
async function safeGetName(userId) {
    try {
        const user = await User.findOne({ userId }).select('username').lean().maxTimeMS(3000);
        if (user?.username) return user.username;
        if (global._tgClient) {
            const ent = await Promise.race([
                global._tgClient.getEntity(userId),
                new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000))
            ]);
            const name = ent.firstName || ent.username || `User${userId.slice(-4)}`;
            // Save for future use
            await User.updateOne({ userId }, { $set: { username: name } }).catch(() => {});
            return name;
        }
    } catch {}
    return `User${userId.toString().slice(-4)}`;
}

// ── GET /status ──
app.get('/status', auth, async (req, res) => {
    try {
        const userId = req.tgUser.id.toString();
        const user = await User.findOne({ userId }).select('lastDaily lastAdWatchDate dailyAdsCount').lean().maxTimeMS(5000);
        const today = new Date().toISOString().split('T')[0];
        if (!user) return res.json({ canClaim: true, hoursLeft: null, adsLeft: 50 });
        if (req.query.type === 'mission_inpage') {
            const ld = user.lastAdWatchDate?.toISOString().split('T')[0];
            const cnt = ld !== today ? 0 : (user.dailyAdsCount || 0);
            return res.json({ canClaim: 50 - cnt > 0, adsLeft: Math.max(0, 50 - cnt) });
        }
        const ld = user.lastDaily?.toISOString().split('T')[0];
        res.json({ canClaim: ld !== today, hoursLeft: ld === today ? 24 : null });
    } catch (err) { res.status(500).json({ error: 'Error' }); }
});

// ── POST /claim ──
app.post('/claim', auth, async (req, res) => {
    try {
        const { type } = req.body;
        const userId = req.tgUser.id.toString();
        let user = await User.findOne({ userId }) || await User.create({ userId, username: req.tgUser.username });
        const today = new Date().toISOString().split('T')[0];
        if (type === 'daily') {
            if (user.lastDaily?.toISOString().split('T')[0] === today) return res.json({ ok: false, error: 'Already claimed' });
            user.wallet += 3000; user.xp += 100; user.lastDaily = new Date(); await user.save();
            if (global._tgClient) try { await global._tgClient.sendMessage(userId, { message: `🎉 <b>+$3000</b> daily reward!` }); } catch {}
            return res.json({ ok: true, reward: 3000, wallet: user.wallet });
        } else if (type === 'mission') {
            const ld = user.lastAdWatchDate?.toISOString().split('T')[0];
            if (ld !== today) user.dailyAdsCount = 0;
            if (user.dailyAdsCount >= 50) return res.json({ ok: false, error: 'Limit reached' });
            user.wallet += 200; user.dailyAdsCount++; user.lastAdWatchDate = new Date(); user.lastMissionClaim = new Date();
            await user.save();
            return res.json({ ok: true, reward: 200, adsLeft: 50 - user.dailyAdsCount, wallet: user.wallet });
        }
        res.status(400).json({ ok: false, error: 'Invalid type' });
    } catch (err) { res.status(500).json({ ok: false, error: 'Error' }); }
});

// ── GET /leaderboard — getEntity with timeout ──
app.get('/leaderboard', auth, async (req, res) => {
    try {
        const { type = 'wallet', period = 'all' } = req.query;
        const sorts = { bank:{bank:-1}, wallet:{wallet:-1}, xp:{xp:-1}, kills:{kills:-1}, robs:{robs:-1} };
        let df = {};
        const now = new Date();
        if (period === 'daily') df = { lastDaily: { $gte: new Date(now.toISOString().split('T')[0]) } };
        else if (period === 'weekly') df = { lastDaily: { $gte: new Date(now - 7*86400000) } };
        else if (period === 'monthly') df = { lastDaily: { $gte: new Date(now - 30*86400000) } };
        const users = await User.find(df).sort(sorts[type]||{wallet:-1}).limit(50)
            .select('userId username wallet bank xp level kills robs').lean().maxTimeMS(5000);
        // Resolve names with timeout — won't hang
        for (const u of users) {
            if (!u.username) u.username = await safeGetName(u.userId);
        }
        res.json({ ok: true, leaderboard: users, type, period });
    } catch (err) { console.error('[API] leaderboard:', err.message); res.status(500).json({ error: 'Error' }); }
});

// ── GET /me ──
app.get('/me', auth, async (req, res) => {
    try {
        const userId = req.tgUser.id.toString();
        let user = await User.findOne({ userId }).lean().maxTimeMS(5000);
        if (!user) { user = (await User.create({ userId, username: req.tgUser.username })).toObject(); }
        res.json({ ok: true, user });
    } catch (err) { res.status(500).json({ error: 'Error' }); }
});

// ── Carrom API ──
app.post('/carrom/start', auth, async (req, res) => {
    try {
        const { gameId } = req.body;
        const sessions = require('./games/sessions');
        const game = sessions.get(gameId);
        if (!game) return res.json({ ok: false, error: 'Not found' });
        if (game.status !== 'lobby') return res.json({ ok: false, error: 'Already started' });
        if (game.hostId !== req.tgUser.id.toString()) return res.json({ ok: false, error: 'Only host' });
        if (game.players.length < 2) return res.json({ ok: false, error: 'Need 2+' });
        if (game.players.length === 3) { game.players.pop(); game.scores.pop(); }
        if (game._timer) clearTimeout(game._timer);
        if (game._autoStart) clearTimeout(game._autoStart);
        for (const p of game.players) { let u = await User.findOne({userId:p.userId})||await User.create({userId:p.userId}); u.wallet-=game.bet; await u.save(); }
        game.start();
        res.json({ ok: true, state: game.getState(req.tgUser.id.toString()) });
    } catch (err) { console.error('[API] carrom/start:', err.message); res.status(500).json({ ok: false, error: 'Error' }); }
});

app.get('/carrom/state', auth, (req, res) => {
    try {
        const sessions = require('./games/sessions');
        const game = sessions.get(req.query.gameId);
        if (!game?.getState) return res.json({ ok: false, error: 'Not found' });
        res.json({ ok: true, state: game.getState(req.tgUser.id.toString()) });
    } catch (err) { res.status(500).json({ ok: false, error: 'Error' }); }
});

app.post('/carrom/move', auth, (req, res) => {
    try {
        const sessions = require('./games/sessions');
        const game = sessions.get(req.body.gameId);
        if (!game?.moveStriker) return res.json({ ok: false, error: 'Not found' });
        const r = game.moveStriker(req.tgUser.id.toString(), req.body.x);
        res.json(r.error ? { ok: false, error: r.error } : { ok: true });
    } catch (err) { res.status(500).json({ ok: false, error: 'Error' }); }
});

app.post('/carrom/shoot', auth, async (req, res) => {
    try {
        const sessions = require('./games/sessions');
        const leveling = require('./utils/leveling');
        const game = sessions.get(req.body.gameId);
        if (!game?.shoot) return res.json({ ok: false, error: 'Not found' });
        const r = game.shoot(req.tgUser.id.toString(), req.body.vx, req.body.vy);
        if (r.error) return res.json({ ok: false, error: r.error });
        if (game.status === 'ended') {
            const winners = game.getWinnerPlayers();
            const pot = game.bet * game.players.length;
            const share = Math.floor(pot / winners.length);
            for (const w of winners) { let u = await User.findOne({userId:w.userId})||await User.create({userId:w.userId}); u.wallet+=share; await leveling.addXP(w.userId,200); await u.save(); }
            if (global._tgClient && game.chatId) try { await global._tgClient.sendMessage(game.chatId, { message: `🏆 <b>CARROM OVER!</b> ${winners.map(w=>w.name).join(' & ')} win <b>$${pot}</b>!` }); } catch {}
            setTimeout(() => sessions.delete(req.body.gameId), 3000);
        }
        res.json({ ok: true, state: game.getState(req.tgUser.id.toString()) });
    } catch (err) { console.error('[API] carrom/shoot:', err.message); res.status(500).json({ ok: false, error: 'Error' }); }
});

// ── Card Web Game API ──
app.get('/wcards/state', auth, (req, res) => {
    try {
        const sessions = require('./games/sessions');
        const game = sessions.get(req.query.gameId);
        if (!game?.getState) return res.json({ ok: false, error: 'Not found' });
        res.json({ ok: true, state: game.getState(req.tgUser.id.toString()) });
    } catch (err) { res.status(500).json({ ok: false, error: 'Error' }); }
});

app.post('/wcards/start', auth, async (req, res) => {
    try {
        const sessions = require('./games/sessions');
        const game = sessions.get(req.body.gameId);
        if (!game) return res.json({ ok: false, error: 'Not found' });
        if (game.hostId !== req.tgUser.id.toString()) return res.json({ ok: false, error: 'Only host' });
        if (!game.start()) return res.json({ ok: false, error: 'Need 2+' });
        if (game._timer) clearTimeout(game._timer);
        if (game._autoStart) clearTimeout(game._autoStart);
        for (const p of game.players) { let u = await User.findOne({userId:p.userId})||await User.create({userId:p.userId}); u.wallet-=game.bet; await u.save(); }
        res.json({ ok: true, state: game.getState(req.tgUser.id.toString()) });
    } catch (err) { res.status(500).json({ ok: false, error: 'Error' }); }
});

app.post('/wcards/play', auth, async (req, res) => {
    try {
        const sessions = require('./games/sessions');
        const leveling = require('./utils/leveling');
        const game = sessions.get(req.body.gameId);
        if (!game) return res.json({ ok: false, error: 'Not found' });
        const r = game.playCard(req.tgUser.id.toString(), req.body.cardIndex);
        if (r.error) return res.json({ ok: false, error: r.error });
        if (game.status === 'ended') {
            const winners = game.getWinners();
            const pot = game.bet * game.players.length;
            const share = Math.floor(pot / winners.length);
            for (const w of winners) { let u = await User.findOne({userId:w.userId})||await User.create({userId:w.userId}); u.wallet+=share; await leveling.addXP(w.userId,150); await u.save(); }
            if (global._tgClient && game.chatId) try { await global._tgClient.sendMessage(game.chatId, { message: `🃏 <b>CARDS OVER!</b> ${winners.map(w=>w.name).join(' & ')} win <b>$${pot}</b>!` }); } catch {}
            setTimeout(() => sessions.delete(req.body.gameId), 5000);
        }
        res.json({ ok: true, state: game.getState(req.tgUser.id.toString()) });
    } catch (err) { res.status(500).json({ ok: false, error: 'Error' }); }
});

app.post('/wcards/next', auth, (req, res) => {
    try {
        const sessions = require('./games/sessions');
        const game = sessions.get(req.body.gameId);
        if (!game) return res.json({ ok: false, error: 'Not found' });
        game.nextRound();
        res.json({ ok: true, state: game.getState(req.tgUser.id.toString()) });
    } catch (err) { res.status(500).json({ ok: false, error: 'Error' }); }
});

// ── Omi API ──
app.get('/omi/state', auth, (req, res) => {
    try {
        const sessions = require('./games/sessions');
        const game = sessions.get(req.query.gameId);
        if (!game?.getState) return res.json({ ok: false, error: 'Not found' });
        res.json({ ok: true, state: game.getState(req.tgUser.id.toString()) });
    } catch { res.status(500).json({ ok: false, error: 'Error' }); }
});

app.post('/omi/start', auth, async (req, res) => {
    try {
        const sessions = require('./games/sessions');
        const game = sessions.get(req.body.gameId);
        if (!game) return res.json({ ok: false, error: 'Not found' });
        if (game.hostId !== req.tgUser.id.toString()) return res.json({ ok: false, error: 'Only host' });
        if (!game.start()) return res.json({ ok: false, error: 'Need 2+' });
        if (game._timer) clearTimeout(game._timer);
        if (game._autoStart) clearTimeout(game._autoStart);
        for (const p of game.players) { let u = await User.findOne({userId:p.userId})||await User.create({userId:p.userId}); u.wallet-=game.bet; await u.save(); }
        res.json({ ok: true, state: game.getState(req.tgUser.id.toString()) });
    } catch (err) { res.status(500).json({ ok: false, error: 'Error' }); }
});

app.post('/omi/trump', auth, (req, res) => {
    try {
        const sessions = require('./games/sessions');
        const game = sessions.get(req.body.gameId);
        if (!game) return res.json({ ok: false, error: 'Not found' });
        const r = game.chooseTrump(req.tgUser.id.toString(), req.body.suit);
        if (r.error) return res.json({ ok: false, error: r.error });
        res.json({ ok: true, state: game.getState(req.tgUser.id.toString()) });
    } catch { res.status(500).json({ ok: false, error: 'Error' }); }
});

app.post('/omi/play', auth, async (req, res) => {
    try {
        const sessions = require('./games/sessions');
        const leveling = require('./utils/leveling');
        const game = sessions.get(req.body.gameId);
        if (!game) return res.json({ ok: false, error: 'Not found' });
        const r = game.playCard(req.tgUser.id.toString(), req.body.cardIndex);
        if (r.error) return res.json({ ok: false, error: r.error });
        if (game.status === 'ended') {
            const winners = game.getWinners();
            const pot = game.bet * game.players.length;
            const share = Math.floor(pot / winners.length);
            for (const w of winners) { let u = await User.findOne({userId:w.userId})||await User.create({userId:w.userId}); u.wallet+=share; await leveling.addXP(w.userId,150); await u.save(); }
            if (global._tgClient && game.chatId) try { await global._tgClient.sendMessage(game.chatId, { message: `🃏 <b>OMI OVER!</b> ${winners.map(w=>w.name).join(' & ')} win <b>$${pot}</b>!` }); } catch {}
            setTimeout(() => sessions.delete(req.body.gameId), 5000);
        }
        res.json({ ok: true, state: game.getState(req.tgUser.id.toString()) });
    } catch (err) { res.status(500).json({ ok: false, error: 'Error' }); }
});

// ── Start ──
const PORT = parseInt(process.env.PORT || '7860');
function startApi() { app.listen(PORT, () => console.log(`[API] Port ${PORT}`)); }
module.exports = { startApi };
