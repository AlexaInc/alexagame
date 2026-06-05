# Alexagame Bot — Bug Fixes Summary

## 🔴 Critical Fix #1: Mini App button — Wrong button type, no initData, "Access Blocked"

**Problem:** The bot sent a `KeyboardButtonSimpleWebView` inside a `ReplyKeyboardMarkup` (reply keyboard). This type of button:
- Does NOT provide `initData` to the Mini App (no user auth)
- The Mini App page sees empty `webapp.initData` → shows "🔒 Access Blocked"
- Even if you bypassed the block, `webapp.sendData()` from this button type produces `MessageActionWebViewDataSentMe` which GramJS's `NewMessage` handler silently drops (it rejects `MessageService` objects)

**Fix:** Changed to `KeyboardButtonWebView` inside `ReplyInlineMarkup` (inline button):
- This is the proper **inline web app button** that Telegram shows under the message
- Telegram provides **full `initData`** (user id, hash, auth_date) to the Mini App
- The Mini App page now sees valid `webapp.initData` → no more "Access Blocked"

## 🔴 Critical Fix #2: Reward claiming — sendData() doesn't work with inline web app buttons

**Problem:** The Mini App used `webapp.sendData("verified_daily_ad_high")` to claim rewards. But `sendData()` only works with `KeyboardButtonSimpleWebView` (reply keyboard). With `KeyboardButtonWebView` (inline button), `sendData()` silently fails — the bot never receives the data.

**Fix:** Replaced `webapp.sendData()` with **HTTP POST to `/claim` endpoint**:
- Mini App calls `POST /claim` with `{ type: "daily" }` or `{ type: "mission" }`
- Passes `webapp.initData` in the `X-Init-Data` header
- Backend verifies the HMAC signature (same crypto verification as before)
- Backend grants the reward, updates MongoDB, returns `{ ok: true, reward, wallet }`
- Backend also sends a confirmation message to the user via MTProto (`global._tgClient.sendMessage()`)
- **Zero Bot API calls** — everything is MTProto + HTTP

## 🔴 Critical Fix #3: All callback button data parsing was broken

**Problem:** Callback data used `_` as delimiter, but gameIds also contained `_` (e.g. `hack_userId_timestamp`). `data.split("_")` produced wrong parts. This broke ALL inline button games.

**Fix:** Changed to `|` (pipe) delimiter. GameIds use `:` (colon). Examples:
- `hinp|hack:123:ts|5`, `mines|mines:123:ts|1|2`, `bjhit|bj:123:ts`
- All under 64-byte Telegram limit

## 🔴 Critical Fix #4: `update.message.replyMarkup` crashes on callbacks

**Problem:** `UpdateBotCallbackQuery` has no `.message` property. Accessing `update.message.replyMarkup` threw errors on every button press.

**Fix:** Keyboards are rebuilt from scratch using helper functions. Game-over states use `new Api.ReplyInlineMarkup({ rows: [] })` to clear buttons.

## 🟡 Fix #5: `buildReplyMarkup([])` produced wrong markup type

**Problem:** Empty array produced `ReplyKeyboardMarkup` instead of `ReplyInlineMarkup`, breaking inline button removal.

**Fix:** Use `new Api.ReplyInlineMarkup({ rows: [] })` explicitly.

## 🟡 Fix #6: `/flip` command conflict

**Problem:** Both coin flip and card game `/flip a` used `/flip`.

**Fix:** Coin flip renamed to `/coinflip`.

## 🟢 Fix #7: Callback error propagation

**Problem:** One failing handler blocked all others.

**Fix:** try/catch wrapping in bot.js.

---

## Architecture (After Fix)

```
User sends /daily
  → Bot sends message with INLINE button (KeyboardButtonWebView in ReplyInlineMarkup)
  → User clicks inline button
  → Telegram opens Mini App with FULL initData (user id, hash, signature)
  → Mini App verifies auth via GET /status (initData HMAC check)
  → User watches ad, waits 30s
  → Mini App calls POST /claim { type: "daily" } with X-Init-Data header
  → Backend verifies HMAC, grants $3000 + 100 XP in MongoDB
  → Backend sends confirmation via MTProto (global._tgClient.sendMessage)
  → Mini App shows success, closes after 3s
```

**No `sendData()`. No Bot API calls. Pure MTProto + HTTP.**

## Files Modified

| File | Changes |
|---|---|
| `bot.js` | Removed WebApp data handler, exposed client as `global._tgClient`, try/catch callbacks |
| `api.js` | Added `POST /claim` endpoint with full reward logic + MTProto confirmation |
| `handlers/economy.js` | `KeyboardButtonWebView` in `ReplyInlineMarkup` (inline button), removed `handleWebAppData` |
| `webapp/index.html` | Replaced `webapp.sendData()` with `POST /claim` API calls |
| `index.html` | Same — replaced `sendData()` with `POST /claim` |
| `handlers/games.js` | Pipe-delimited callbacks, keyboard rebuild helpers |
| `handlers/inlineGames.js` | Pipe-delimited callbacks |
| `handlers/inlineHandler.js` | Complete rewrite with proper parsing |
| `handlers/boardGames.js` | Pipe-delimited callbacks |
| `handlers/boardHandler.js` | Pipe-delimited callbacks, proper join/move parsing |
| `handlers/blackjack.js` | Pipe-delimited callbacks |
