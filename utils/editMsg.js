const { Api } = require("telegram");
const { _parseMessageText } = require("telegram/client/messageParse");

/**
 * Edit message with HTML parse mode and optional button update.
 */
async function editMsg(client, peer, msgId, text, buttons) {
    try {
        // Parse HTML to text + entities
        const [parsedText, entities] = await _parseMessageText(client, text, 'html');
        const inputPeer = await client.getInputEntity(peer);

        let replyMarkup;
        if (buttons === null || buttons === undefined) {
            replyMarkup = new Api.ReplyInlineMarkup({ rows: [] });
        } else if (Array.isArray(buttons) && buttons.length > 0) {
            replyMarkup = client.buildReplyMarkup(buttons);
        }

        const params = {
            peer: inputPeer,
            id: msgId,
            message: parsedText,
            entities: entities,
            noWebpage: true,
        };
        if (replyMarkup) params.replyMarkup = replyMarkup;

        await client.invoke(new Api.messages.EditMessage(params));
    } catch (e) {
        if (e.message && e.message.includes('REPLY_MARKUP_INVALID')) {
            try {
                const [parsedText, entities] = await _parseMessageText(client, text, 'html');
                const inputPeer = await client.getInputEntity(peer);
                await client.invoke(new Api.messages.EditMessage({
                    peer: inputPeer,
                    id: msgId,
                    message: parsedText,
                    entities: entities,
                    noWebpage: true,
                }));
            } catch (e2) {
                console.error('[editMsg] fallback failed:', e2.message);
            }
        } else if (e.message && e.message.includes('MESSAGE_NOT_MODIFIED')) {
            // same content, ignore
        } else {
            console.error('[editMsg] error:', e.message);
        }
    }
}

module.exports = { editMsg };
