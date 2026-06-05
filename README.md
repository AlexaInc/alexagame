---
title: Alexagame
emoji: 🐢
colorFrom: green
colorTo: gray
sdk: docker
pinned: false
---
# Telegram Game Bot

A feature-rich Telegram game bot built with Node.js, GramJS, and MongoDB.

## Features

### 💰 Economy & Banking
- **Wallet vs Bank**: Keep money in the wallet for betting, or move it to the bank (`/dp`) to protect it from robbery.
- **Daily Rewards**: `/daily` to claim $1000 every 24 hours.
- **Robbery**: `/rob` (reply to user) to steal from their wallet. 40% success rate, failure results in health loss or death.

### ⚔️ Combat & Health
- **Kill**: `/kill` (reply to user) to execute them and gain money. 
- **Death**: Dead users cannot play games or rob.
- **Revive**: Automatically revive after 4 hours, or pay $1000 with `/revive`.

### 🎮 Multiplayer Games
1.  **Multi-Hack**: `/hack <bet> <len>` - Lobby based PIN cracking game. Turn-based with mentions.
2.  **Tic-Tac-Toe (XOX)**: `/xox <bet>` - Strategic board game via inline buttons.
3.  **Connect Four**: `/c4 <bet>` - Gravity-based strategy game.
4.  **Dice Duel**: `/dice <bet>` - Quick betting roll.

### 🃏 Casino & Inline Games
5.  **Blackjack**: `/bj <bet>` - Full card game against dealer.
6.  **Mines**: Avoid bombs in a 3x3 grid to multiply your bet.
7.  **Slots**: Classic fruit machine.
8.  **Russian Roulette**: 1/6 chance of death, 5x payout.
9.  **Higher or Lower**: Guess number sequences for streaks.
10. **Coin Flip**: Simple 50/50 bet.

## Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file based on `.env.example` and add your Telegram API credentials and MongoDB URI.

3. Run the bot:
   ```bash
   node bot.js
   ```

## All Commands
- `/start` - Show menu
- `/wallet` - Balance & Health
- `/daily` - Claim cash
- `/dp <amt|all>` - Deposit to bank
- `/wd <amt|all>` - Withdraw from bank
- `/kill` (reply) - Attack user
- `/rob` (reply) - Steal from wallet
- `/revive` - Return to life
- `/hack <bet> <len>` - Multi-Hack Lobby
- `/join` - Join active lobby
- `/guess <pin>` - Submit hack guess
- `/xox <bet>` - Start Tic-Tac-Toe
- `/c4 <bet>` - Start Connect Four
- `/bj <bet>` - Start Blackjack
- `/slots` - Play Slots
- `/mines` - Play Mines
- `/flip` - Coin Flip
- `/roulette` - Russian Roulette
- `/hl` - Higher or Lower
- `/dice <bet>` - Dice Duel
