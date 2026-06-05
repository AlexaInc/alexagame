/**
 * Simple in-memory cache for MongoDB queries.
 * TTL-based, auto-evicts expired entries.
 * Reduces DB load for frequent reads (wallet checks, leaderboard, etc.)
 */
const User = require('../models/User');

const cache = new Map();
const DEFAULT_TTL = 15000; // 15 seconds
const LEADERBOARD_TTL = 30000; // 30 seconds

function getCacheKey(type, id) { return `${type}:${id}`; }

function setCache(key, data, ttl = DEFAULT_TTL) {
    cache.set(key, { data, expires: Date.now() + ttl });
}

function getCache(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) { cache.delete(key); return null; }
    return entry.data;
}

function invalidate(userId) {
    // Clear all cache entries for this user
    for (const [key] of cache) {
        if (key.includes(userId)) cache.delete(key);
    }
}

// Periodic cleanup of expired entries (every 60s)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache) {
        if (now > entry.expires) cache.delete(key);
    }
}, 60000);

/**
 * Get user with cache. Returns lean object.
 */
async function getUser(userId) {
    const key = getCacheKey('user', userId);
    const cached = getCache(key);
    if (cached) return cached;
    const user = await User.findOne({ userId }).lean().maxTimeMS(5000);
    if (user) setCache(key, user);
    return user;
}

/**
 * Get or create user.
 */
async function getOrCreateUser(userId, extra = {}) {
    let user = await getUser(userId);
    if (!user) {
        user = (await User.create({ userId, ...extra })).toObject();
        setCache(getCacheKey('user', userId), user);
    }
    return user;
}

/**
 * Update user and invalidate cache.
 */
async function saveUser(userId, updateFn) {
    let user = await User.findOne({ userId }) || await User.create({ userId });
    await updateFn(user);
    await user.save();
    invalidate(userId);
    return user;
}

module.exports = { getUser, getOrCreateUser, saveUser, invalidate, setCache, getCache, getCacheKey, LEADERBOARD_TTL };
