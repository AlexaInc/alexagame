/*
 * cards-deck.js — Full playing-card SVG deck for AlexaGame web apps.
 * ------------------------------------------------------------------
 * Drop-in replacement for the old hand-drawn cardSVG()/cardBackSVG().
 *
 *   CardsDeck.getCardSVG(label, suit, opts)  -> SVG string for one card
 *   CardsDeck.getCardBackSVG(opts)           -> SVG string for the card back
 *
 * Card art reproduces the cards.revk.uk SVG deck geometry exactly:
 *   - viewBox "-120 -168 240 336"  (centre origin, 2.5in x 3.5in poker ratio)
 *   - exact Spade / Heart / Diamond / Club pip shapes
 *   - exact rank index glyphs (A,2-10,J,Q,K) drawn as strokes
 *   - exact pip-centre coordinates per rank (verified against the deck output)
 *   - lower-half pips are rotated 180° just like the real deck
 *   - court cards (J/Q/K) use the deck's clean "plain" large-letter style so
 *     the whole pack stays visually consistent and renders perfectly inline
 *     (no external fonts / images needed inside Telegram WebApp sandboxes).
 *
 * Game card objects use:  label in {2..10, J, Q, K, A}   suit in {♠,♥,♦,♣}
 * (label may also be 'T' for ten, and suit may be a code letter S/H/D/C).
 *
 * Exposes a global `CardsDeck` and, under CommonJS, module.exports.
 */
(function (root) {
  'use strict';

  /* -------- suit metadata ------------------------------------------------ */
  var SUIT_CODE  = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };
  var SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };
  var RED        = { H: true, D: true, S: false, C: false };

  function suitColour(code) { return RED[code] ? '#d40000' : '#000000'; }
  function toCode(suit) {
    if (SUIT_GLYPH[suit]) return suit;              // already a code letter
    return SUIT_CODE[suit] || 'S';
  }

  /* -------- suit pip shapes (exact deck paths, viewBox -600..600) -------- */
  var SUIT_PIP = {
    S: 'M0 -500C100 -250 355 -100 355 185A150 150 0 0 1 55 185A10 10 0 0 0 35 185C35 385 85 400 130 500L-130 500C-85 400 -35 385 -35 185A10 10 0 0 0 -55 185A150 150 0 0 1 -355 185C-355 -100 -100 -250 0 -500Z',
    H: 'M0 -300C0 -400 100 -500 200 -500C300 -500 400 -400 400 -250C400 0 0 400 0 500C0 400 -400 0 -400 -250C-400 -400 -300 -500 -200 -500C-100 -500 0 -400 -0 -300Z',
    D: 'M-400 0C-350 0 0 -450 0 -500C0 -450 350 0 400 0C350 0 0 450 0 500C0 450 -350 0 -400 0Z',
    C: 'M30 150C35 385 85 400 130 500L-130 500C-85 400 -35 385 -30 150A10 10 0 0 0 -50 150A210 210 0 1 1 -124 -51A10 10 0 0 0 -110 -65A230 230 0 1 1 110 -65A10 10 0 0 0 124 -51A210 210 0 1 1 50 150A10 10 0 0 0 30 150Z'
  };

  /* -------- rank index glyphs (exact deck stroke paths, viewBox -500..500) */
  var INDEX_GLYPH = {
    'A':  'M-270 460L-110 460M-200 450L0 -460L200 450M110 460L270 460M-120 130L120 130',
    '2':  'M-225 -225C-245 -265 -200 -460 0 -460C 200 -460 225 -325 225 -225C225 -25 -225 160 -225 460L225 460L225 300',
    '3':  'M-250 -320L-250 -460L200 -460L-110 -80C-100 -90 -50 -120 0 -120C200 -120 250 0 250 150C250 350 170 460 -30 460C-230 460 -260 300 -260 300',
    '4':  'M50 460L250 460M150 460L150 -460L-300 175L-300 200L270 200',
    '5':  'M170 -460L-175 -460L-210 -115C-210 -115 -200 -200 0 -200C100 -200 255 -80 255 120C255 320 180 460 -20 460C-220 460 -255 285 -255 285',
    '6':  'M-250 100A250 250 0 0 1 250 100L250 210A250 250 0 0 1 -250 210L-250 -210A250 250 0 0 1 0 -460C150 -460 180 -400 200 -375',
    '7':  'M-265 -320L-265 -460L265 -460C135 -200 -90 100 -90 460',
    '8':  'M-1 -50A205 205 0 1 1 1 -50L-1 -50A255 255 0 1 0 1 -50Z',
    '9':  'M250 -100A250 250 0 0 1 -250 -100L-250 -210A250 250 0 0 1 250 -210L250 210A250 250 0 0 1 0 460C-150 460 -180 400 -200 375',
    '10': 'M-260 430L-260 -430M-50 0L-50 -310A150 150 0 0 1 250 -310L250 310A150 150 0 0 1 -50 310Z',
    'J':  'M50 -460L250 -460M150 -460L150 250A100 100 0 0 1 -250 250L-250 220',
    'Q':  'M-260 100C40 100 -40 460 260 460M-175 0L-175 -285A175 175 0 0 1 175 -285L175 285A175 175 0 0 1 -175 285Z',
    'K':  'M-285 -460L-85 -460M-185 -460L-185 460M-285 460L-85 460M85 -460L285 -460M185 -440L-170 155M85 460L285 460M185 440L-10 -70'
  };

  /* -------- definitive pip-centre layouts (verified vs. the deck output) --
   * Pips with y > 0 (lower half) are rendered rotated 180°, exactly like the
   * real deck, so the suit symbol points the correct way for the opponent.   */
  var PIP_CENTRES = {
    'A':  [[0, 0]],
    '2':  [[0, -100.501], [0, 100.501]],
    '3':  [[0, -100.501], [0, 0], [0, 100.501]],
    '4':  [[-52.501, -100.501], [52.501, -100.501], [-52.501, 100.501], [52.501, 100.501]],
    '5':  [[-52.501, -100.501], [52.501, -100.501], [0, 0], [-52.501, 100.501], [52.501, 100.501]],
    '6':  [[-52.501, -100.501], [52.501, -100.501], [-52.501, 0], [52.501, 0], [-52.501, 100.501], [52.501, 100.501]],
    '7':  [[-52.501, -100.501], [52.501, -100.501], [0, -50.25], [-52.501, 0], [52.501, 0], [-52.501, 100.501], [52.501, 100.501]],
    '8':  [[-52.501, -100.501], [52.501, -100.501], [0, -50.25], [-52.501, 0], [52.501, 0], [0, 50.25], [-52.501, 100.501], [52.501, 100.501]],
    '9':  [[-52.501, -100.501], [52.501, -100.501], [-52.501, -33.5], [52.501, -33.5], [0, 0], [-52.501, 33.5], [52.501, 33.5], [-52.501, 100.501], [52.501, 100.501]],
    '10': [[-52.501, -100.501], [52.501, -100.501], [-52.501, -33.5], [52.501, -33.5], [0, -67], [-52.501, 33.5], [52.501, 33.5], [0, 67], [-52.501, 100.501], [52.501, 100.501]]
  };

  var PIP_SIZE = 70;

  /* -------- helpers ------------------------------------------------------ */
  function r(n) { return Math.round(n * 1000) / 1000; }

  // A pip placed at centre (cx,cy); pips below the mid-line are rotated 180°.
  function pipUse(suitCode, cx, cy, size) {
    var s = size || PIP_SIZE;
    if (cy > 0) {
      // rotate 180 about the pip centre: translate to centre, rotate, draw box
      return '<g transform="rotate(180 ' + r(cx) + ' ' + r(cy) + ')">' +
        rawPip(suitCode, cx, cy, s) + '</g>';
    }
    return rawPip(suitCode, cx, cy, s);
  }
  function rawPip(suitCode, cx, cy, s) {
    return '<use href="#cd-pip-' + suitCode + '" xlink:href="#cd-pip-' + suitCode + '"' +
      ' x="' + r(cx - s / 2) + '" y="' + r(cy - s / 2) + '"' +
      ' width="' + s + '" height="' + s + '"/>';
  }

  // Corner index (rank glyph + small suit pip), authored top-left.
  function cornerIndex(rank, suitCode, col) {
    var idx = '<use href="#cd-idx-' + rank + '" xlink:href="#cd-idx-' + rank + '"' +
      ' x="-114.4" y="-156" width="32" height="32" style="color:' + col + '"/>';
    var pip = '<use href="#cd-pip-' + suitCode + '" xlink:href="#cd-pip-' + suitCode + '"' +
      ' x="-111.784" y="-119" width="26.769" height="26.769"/>';
    return idx + pip;
  }

  function svgOpen(w, h, cls, suitCode, rank) {
    return '<svg xmlns="http://www.w3.org/2000/svg"' +
      ' xmlns:xlink="http://www.w3.org/1999/xlink"' + cls +
      ' face="' + rank + suitCode + '"' +
      ' width="' + w + '" height="' + h + '"' +
      ' viewBox="-120 -168 240 336" preserveAspectRatio="xMidYMid meet">';
  }

  function cardBase() {
    return '<rect width="239" height="335" x="-119.5" y="-167.5" rx="12" ry="12"' +
      ' fill="white" stroke="black" stroke-width="0.75"/>';
  }

  function defsBlock(suitCode, rank) {
    return '<defs>' +
      '<symbol id="cd-pip-' + suitCode + '" viewBox="-600 -600 1200 1200"' +
      ' preserveAspectRatio="xMidYMid meet">' +
      '<path d="' + SUIT_PIP[suitCode] + '" fill="' + suitColour(suitCode) + '"/>' +
      '</symbol>' +
      '<symbol id="cd-idx-' + rank + '" viewBox="-500 -500 1000 1000"' +
      ' preserveAspectRatio="xMidYMid meet">' +
      '<path d="' + INDEX_GLYPH[rank] + '" stroke="currentColor" stroke-width="80"' +
      ' stroke-linecap="square" stroke-miterlimit="1.5" fill="none"/>' +
      '</symbol>' +
      '</defs>';
  }

  /* -------- bodies ------------------------------------------------------- */
  function pipBody(rank, suitCode) {
    var list = PIP_CENTRES[rank] || PIP_CENTRES['A'];
    var out = '';
    for (var i = 0; i < list.length; i++) out += pipUse(suitCode, list[i][0], list[i][1]);
    return out;
  }

  // Court card: framed panel + large rank letter + big watermark suit pip.
  function courtBody(rank, suitCode, col) {
    var frame =
      '<rect x="-99" y="-147" width="198" height="294" rx="10" fill="none"' +
      ' stroke="' + col + '" stroke-width="2.5" opacity="0.85"/>' +
      '<rect x="-92" y="-140" width="184" height="280" rx="8" fill="none"' +
      ' stroke="' + col + '" stroke-width="1" opacity="0.45"/>';
    // soft watermark suit behind the letter
    var watermark = '<use href="#cd-pip-' + suitCode + '" xlink:href="#cd-pip-' + suitCode + '"' +
      ' x="-62" y="-40" width="124" height="124" opacity="0.14"/>';
    var letter =
      '<text x="0" y="6" text-anchor="middle" dominant-baseline="central"' +
      ' font-family="Georgia,\'Times New Roman\',serif" font-weight="700"' +
      ' font-size="150" fill="' + col + '">' + rank + '</text>';
    // small suit pips flanking the letter at top & bottom of the panel
    var topPip = '<use href="#cd-pip-' + suitCode + '" xlink:href="#cd-pip-' + suitCode + '"' +
      ' x="-22" y="-128" width="44" height="44"/>';
    var botPip = '<g transform="rotate(180)">' +
      '<use href="#cd-pip-' + suitCode + '" xlink:href="#cd-pip-' + suitCode + '"' +
      ' x="-22" y="-128" width="44" height="44"/></g>';
    return frame + watermark + topPip + botPip + letter;
  }

  /* -------- public: getCardSVG ------------------------------------------ */
  function getCardSVG(label, suit, opts) {
    opts = opts || {};
    var w = opts.width || 55;
    var h = opts.height || 80;
    var cls = opts.class ? ' class="' + opts.class + '"' : '';
    var suitCode = toCode(suit);
    var rank = (label === 'T') ? '10' : String(label);
    var col = suitColour(suitCode);
    var isCourt = (rank === 'J' || rank === 'Q' || rank === 'K');

    var body = isCourt ? courtBody(rank, suitCode, col) : pipBody(rank, suitCode);
    var corner = cornerIndex(rank, suitCode, col);
    var corners = corner + '<g transform="rotate(180)">' + corner + '</g>';

    return svgOpen(w, h, cls, suitCode, rank) +
      defsBlock(suitCode, rank) +
      cardBase() +
      body +
      corners +
      '</svg>';
  }

  /* -------- public: getCardBackSVG -------------------------------------- */
  function getCardBackSVG(opts) {
    opts = opts || {};
    var w = opts.width || 55;
    var h = opts.height || 80;
    var cls = opts.class ? ' class="' + opts.class + '"' : '';
    var colour = opts.colour || '#1e3a8a';
    var accent = opts.accent || '#3b82f6';
    var id = 'cd-back-' + Math.random().toString(36).slice(2, 8);
    return '<svg xmlns="http://www.w3.org/2000/svg"' +
      ' xmlns:xlink="http://www.w3.org/1999/xlink"' + cls +
      ' width="' + w + '" height="' + h + '"' +
      ' viewBox="-120 -168 240 336" preserveAspectRatio="xMidYMid meet">' +
      '<defs><pattern id="' + id + '" width="24" height="24" patternUnits="userSpaceOnUse">' +
      '<path d="M12 0L24 12L12 24L0 12Z" fill="' + accent + '" opacity="0.55"/>' +
      '</pattern></defs>' +
      '<rect width="239" height="335" x="-119.5" y="-167.5" rx="12" ry="12"' +
      ' fill="' + colour + '" stroke="black" stroke-width="0.75"/>' +
      '<rect x="-108" y="-156" width="216" height="312" rx="10" fill="url(#' + id + ')"/>' +
      '<rect x="-108" y="-156" width="216" height="312" rx="10" fill="none"' +
      ' stroke="' + accent + '" stroke-width="3"/>' +
      '</svg>';
  }

  var api = {
    getCardSVG: getCardSVG,
    getCardBackSVG: getCardBackSVG,
    SUIT_CODE: SUIT_CODE,
    SUIT_GLYPH: SUIT_GLYPH
  };
  root.CardsDeck = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
