/*
 * giveup.js — shared "Give Up / Forfeit" helper for AlexaGame web games.
 *
 * Adds a consistent confirm-then-forfeit flow used by carrom.html,
 * cards.html and omi.html.
 *
 *   GiveUp.button()                  -> HTML string for the give-up button
 *   GiveUp.confirm(opts)             -> shows confirm popup, calls forfeit RPC
 *
 * opts = {
 *   rpc:      async (method, path, body) => json   // the page's rpc() fn
 *   path:     '/omi/forfeit'                        // forfeit endpoint
 *   gameId:   'omi:123'                             // current game id
 *   onState:  (state) => {}                         // apply returned state
 *   onError:  (msg)   => {}                         // show an error (optional)
 *   game:     'Omi'                                 // name for the prompt (optional)
 * }
 *
 * The button label/colour come from the page's own .abtn / styles where
 * present; a fallback inline style keeps it usable anywhere.
 */
(function (root) {
  'use strict';

  var tg = (root.Telegram && root.Telegram.WebApp) || null;

  // Native Telegram confirm popup with a plain confirm() fallback.
  function askConfirm(message) {
    return new Promise(function (resolve) {
      if (tg && typeof tg.showConfirm === 'function') {
        try {
          tg.showConfirm(message, function (ok) { resolve(!!ok); });
          return;
        } catch (e) { /* fall through */ }
      }
      // Fallback for browsers / older clients
      try { resolve(root.confirm(message)); }
      catch (e) { resolve(false); }
    });
  }

  function button(opts) {
    opts = opts || {};
    var id = opts.id || 'giveUpBtn';
    var cls = opts.class || 'abtn r';
    // Inline fallback so it still looks like a danger button without page CSS.
    var style = 'background:#ef4444;color:#fff;border:none;border-radius:8px;' +
      'padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer;';
    return '<button id="' + id + '" class="' + cls + '" style="' + style +
      '" onclick="GiveUp._click()">🏳️ Give Up</button>';
  }

  // Stored config for the inline onclick handler.
  var _cfg = null;

  // Page calls GiveUp.bind({...}) once it knows its rpc/gameId/handlers,
  // then renders GiveUp.button() wherever it likes.
  function bind(opts) { _cfg = opts || null; }

  function _click() { if (_cfg) confirm(_cfg); }

  async function confirm(opts) {
    opts = opts || _cfg || {};
    var name = opts.game ? (' the ' + opts.game + ' game') : ' this game';
    var msg = 'Give up' + name + '? Your opponent(s) will win. This cannot be undone.';
    var yes = await askConfirm(msg);
    if (!yes) return;

    var btn = document.getElementById(opts.id || 'giveUpBtn');
    if (btn) { btn.disabled = true; btn.textContent = '🏳️ Giving up…'; }

    try {
      var r = await opts.rpc('POST', opts.path, { gameId: opts.gameId });
      if (r && r.ok) {
        if (opts.onState) opts.onState(r.state);
        if (tg && tg.HapticFeedback) try { tg.HapticFeedback.notificationOccurred('warning'); } catch (e) {}
      } else {
        if (opts.onError) opts.onError((r && r.error) || 'Could not give up');
        if (btn) { btn.disabled = false; btn.textContent = '🏳️ Give Up'; }
      }
    } catch (e) {
      if (opts.onError) opts.onError('Network error');
      if (btn) { btn.disabled = false; btn.textContent = '🏳️ Give Up'; }
    }
  }

  root.GiveUp = {
    button: button,
    bind: bind,
    confirm: confirm,
    _click: _click
  };
})(typeof window !== 'undefined' ? window : globalThis);
