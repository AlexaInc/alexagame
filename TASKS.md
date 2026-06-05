# 📋 Feature Roadmap & Task List

## ✅ Done
- [x] Checkers (inline buttons, flying kings, multi-jump, chain capture)
- [x] Chess (inline buttons, full piece rules)
- [x] Tic-Tac-Toe, Connect 4
- [x] Blackjack, Slots, Mines, Coin, Roulette, Higher/Lower
- [x] Dice Duel, RPS, Card Game, Multiplayer Hack
- [x] Kill/Rob/Revive combat system
- [x] Daily reward + Ad missions (Mini App)
- [x] Leaderboards (wallet/bank/xp/kills/robs, daily/weekly/monthly/all)
- [x] 60s lobby timeout for all multiplayer games
- [x] Pot system (entry × 2 = winner takes all)
- [x] HTML markup for all messages
- [x] Banner + video display ads on webapp pages
- [x] Shop system (/shop, /buy, /gift with GIF messages)
- [x] Collection/Inventory system (/collection, reply to see other user's)
- [x] /wallet shows replied user's wallet when replying
- [x] /rob requires amount (/rob 500), shows victim's actual balance if too low
- [x] Auto-earn from chatting (max $1000/day, $1-15 per message)
- [x] Admin: /add <value> — add money to user wallet
- [x] Admin: /addblacklist — blacklist user from bot
- [x] Admin: /unblacklist — remove from blacklist
- [x] Admin: /blacklist — show all blacklisted users
- [x] Blacklisted users silently blocked from all commands + buttons
- [x] /coin command (renamed from /coinflip)

---

## 🎮 Multiplayer Casino Games to Add (Bot Commands — Inline Buttons)

### 🃏 Poker (Texas Hold'em) — `/poker <bet>`
- 2-6 players, lobby + join
- Deal 2 hole cards, 5 community cards (flop/turn/river)
- Betting rounds with raise/call/fold buttons
- Hand ranking: Royal Flush → High Card
- Winner takes pot

### 🎰 War (Card War) — `/war <bet>`
- 2 players, each draws 1 card
- Highest card wins the pot
- Tie = "WAR" → draw 3 face-down + 1 face-up, highest wins all
- Simple, fast, high stakes

### 🎲 Liar's Dice — `/liar <bet>`
- 2-4 players, each rolls 5 dice (hidden)
- Take turns bidding "there are at least X dice showing Y"
- Next player: raise bid or call "LIAR!"
- If liar → caller wins. If truth → bidder wins
- Elimination style, last player standing wins pot

### 🃏 Baccarat — `/baccarat <bet>`
- 2 players bet on Player/Banker/Tie
- Deal 2-3 cards per side, closest to 9 wins
- Natural 8 or 9 = instant win
- Side bets possible

### 🎯 Crash — `/crash <bet>`
- Multiplayer (2+ players)
- Multiplier starts at 1.0x and rises
- Players tap "Cash Out" button before it crashes
- If crash before cashout → lose bet
- Last to cash out before crash = highest reward

### 🎲 Craps — `/craps <bet>`
- 2+ players, one rolls dice
- Bet on Pass/Don't Pass/Come/Don't Come
- Natural 7 or 11 on come-out = win
- 2, 3, 12 = craps (lose)
- Point system for subsequent rolls

### 🃏 21 Duel — `/duel21 <bet>`
- 2 players each play blackjack simultaneously
- Both try to get closest to 21
- Higher score without busting wins pot
- Both bust = draw, refund

---

## 🌐 Web App Mini Games to Add (Telegram Mini App — HTML/JS)

### ⚫ Gomoku 15×15 (Full Size)
- Full 15×15 Five in a Row in Mini App canvas
- Touch/tap to place pieces
- Real-time multiplayer via WebSocket or polling
- Bigger board = deeper strategy than 8×8 bot version
- Bet-based, pot to winner

### 🐍 Snake & Earn
- Classic snake game in Mini App canvas
- Longer snake = more coins earned
- Daily high score leaderboard
- Earn $50-500 per game based on score

### 🧱 2048
- Tile merging puzzle game
- Reach 2048 tile = bonus $1000
- Score-based earnings
- Compete on leaderboard

### 🎮 Flappy Bird Clone
- Tap to fly through pipes
- Each pipe passed = $10
- High score leaderboard
- Daily/weekly rewards for top scorers

### 🏃 Endless Runner
- Side-scrolling runner, tap to jump
- Collect coins ($5 each), avoid obstacles
- Distance-based XP rewards
- Power-ups purchasable with in-game currency

### 🧩 Word Scramble
- Unscramble letters to form words
- Timed rounds: faster = more reward
- Multiplayer mode: first to solve wins pot
- Daily word challenges for bonus

### 🎯 Tap Battle (Multiplayer)
- 2 players tap as fast as possible for 10 seconds
- More taps wins
- Bet-based, pot to winner
- Anti-cheat: max 15 taps/sec

### 🃏 Memory Card Match
- Grid of face-down cards, find matching pairs
- Fewer moves = higher reward
- Timed mode with countdown
- Multiplayer: alternate turns, most pairs wins

### 🏗️ Tower Builder
- Stack blocks, keep them aligned
- Misaligned = block shrinks
- Height-based rewards
- Daily challenges

---

## 📢 Ad Placement Strategy

### Currently Active
- **Rewarded TMA ads** (spot 6120581) — for daily claim + mission claims
- **In-page TMA ads** (spot 6120578) — during daily verification
- **Banner display** (spot 6120647) — between reward cards & below leaderboard
- **Video/in-stream** (spot 6120648) — wallet page bottom

### Rules
- ❌ NO popup ads during gameplay (chess/checkers board, overlays)
- ✅ Banner ads between content sections
- ✅ Video ads on wallet/profile pages
- ✅ Rewarded ads for claiming rewards (user-initiated)
- 💡 Future: interstitial ad between game sessions (after game ends, before returning to menu)

### Planned Ad Spots
- [ ] Interstitial after game win/loss (before showing final result)
- [ ] Banner below leaderboard entries (every 10 rows)
- [ ] Native ad card in reward page (looks like a reward card)
- [ ] Pre-roll video before web mini games start

---

## 🔧 Technical Improvements
- [ ] Add castling and en passant to chess
- [ ] Add check/checkmate detection to chess (currently wins by king capture)
- [ ] Add stalemate detection
- [ ] Add game history/replay
- [ ] Add user profiles with avatars
- [ ] Add friend system / challenge specific user
- [ ] Add tournament brackets
- [ ] Add spectator mode for ongoing games
- [ ] Rate limiting for commands
- [ ] Anti-cheat for web mini games
- [ ] Persistent game state (survive bot restart via MongoDB)
- [ ] Localization (multi-language support)
