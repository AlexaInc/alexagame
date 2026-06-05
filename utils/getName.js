/**
 * Get display name for a user ID.
 * Tries TG client first, falls back to DB username, then generic.
 */
async function getName(client, userId) {
    try {
        if (client) {
            const ent = await client.getEntity(userId);
            return ent.firstName || ent.username || `User${userId.toString().slice(-4)}`;
        }
    } catch (e) {}
    return `User${userId.toString().slice(-4)}`;
}

module.exports = { getName };
