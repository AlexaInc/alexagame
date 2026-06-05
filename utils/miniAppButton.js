/**
 * Create a mini app button that works in BOTH groups and private chats.
 * 
 * - Private chat: use KeyboardButtonWebView (inline, gives initData)
 * - Group chat: use KeyboardButtonUrl with t.me/bot?startapp=param link
 *   (KeyboardButtonWebView throws BUTTON_TYPE_INVALID in groups)
 */
const { Api } = require("telegram");

function getBotUsername() {
    // Extract from BOT_TOKEN or use env
    return process.env.BOT_USERNAME || 'Alexagamebot';
}

function getWebAppUrl() {
    return process.env.WEBAPP_HTTPS_URL || 'https://huggingface.co/spaces/alexaincsl/alexagame';
}

/**
 * Build inline markup with a mini app button.
 * @param {string} text - Button label
 * @param {string} startAppParam - The ?startapp= parameter (e.g. 'daily', 'mission', 'carrom_gameId')
 * @param {boolean} isGroup - Whether the chat is a group
 */
function miniAppButton(text, startAppParam, isGroup) {
    if (isGroup) {
        // Group: use URL button with t.me deep link
        const url = `https://t.me/${getBotUsername()}?startapp=${startAppParam}`;
        return new Api.ReplyInlineMarkup({
            rows: [new Api.KeyboardButtonRow({
                buttons: [new Api.KeyboardButtonUrl({ text, url })]
            })]
        });
    } else {
        // Private: use WebView button (gives initData)
        const url = getWebAppUrl() + '?type=' + startAppParam;
        return new Api.ReplyInlineMarkup({
            rows: [new Api.KeyboardButtonRow({
                buttons: [new Api.KeyboardButtonWebView({ text, url })]
            })]
        });
    }
}

/**
 * Check if chat is a group/supergroup
 */
function isGroupChat(chatId) {
    const id = chatId.toString();
    return id.startsWith('-');
}

module.exports = { miniAppButton, isGroupChat, getBotUsername, getWebAppUrl };
