/**
 * Shop items catalog.
 * gifDir: folder name under ./gifs/ containing .gif files (0.gif, 1.gif, etc.)
 */
const SHOP_ITEMS = [
    { id: '1',  name: 'Rose',          emoji: '🌹', price: 500,   xpRate: 0.2, gifDir: 'rose' },
    { id: '2',  name: 'Teddy Bear',    emoji: '🧸', price: 1200,  xpRate: 0.2, gifDir: 'teddy' },
    { id: '3',  name: 'Diamond Ring',  emoji: '💍', price: 5000,  xpRate: 0.2, gifDir: 'ring' },
    { id: '4',  name: 'Crown',         emoji: '👑', price: 10000, xpRate: 0.2, gifDir: 'crown' },
    { id: '5',  name: 'Chocolate',     emoji: '🍫', price: 300,   xpRate: 0.2, gifDir: 'chocolate' },
    { id: '6',  name: 'Star',          emoji: '⭐', price: 800,   xpRate: 0.2, gifDir: 'star' },
    { id: '7',  name: 'Heart',         emoji: '❤️', price: 600,   xpRate: 0.2, gifDir: 'heart' },
    { id: '8',  name: 'Trophy',        emoji: '🏆', price: 3000,  xpRate: 0.2, gifDir: 'trophy' },
    { id: '9',  name: 'Fire',          emoji: '🔥', price: 1500,  xpRate: 0.2, gifDir: 'fire' },
    { id: '10', name: 'Rocket',        emoji: '🚀', price: 2000,  xpRate: 0.2, gifDir: 'rocket' },
];

function getItem(id) {
    return SHOP_ITEMS.find(i => i.id === id.toString());
}

function calcXP(price, rate) {
    return Math.floor(price * (rate || 0.2));
}

module.exports = { SHOP_ITEMS, getItem, calcXP };
