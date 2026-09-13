// --- Fake Poker: Texas Hold'em Game Engine ---

const SUITS = [
  { symbol: '♠', color: 'black' },
  { symbol: '♥', color: 'red' },
  { symbol: '♦', color: 'red' },
  { symbol: '♣', color: 'black' }
];

const RANKS = [
  { rank: '2', val: 2 },
  { rank: '3', val: 3 },
  { rank: '4', val: 4 },
  { rank: '5', val: 5 },
  { rank: '6', val: 6 },
  { rank: '7', val: 7 },
  { rank: '8', val: 8 },
  { rank: '9', val: 9 },
  { rank: '10', val: 10 },
  { rank: 'J', val: 11 },
  { rank: 'Q', val: 12 },
  { rank: 'K', val: 13 },
  { rank: 'A', val: 14 }
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getSecureRandomInt(max) {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    const maxUint32 = 0xFFFFFFFF;
    const limit = maxUint32 - (maxUint32 % max);
    let val;
    do {
      window.crypto.getRandomValues(arr);
      val = arr[0];
    } while (val >= limit);
    return val % max;
  }
  return Math.floor(Math.random() * max);
}

// Sound Synthesizer via Web Audio API
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playChip() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800 + Math.random() * 400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playCard() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  playWin() {
    if (!this.enabled || !this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.1);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + idx * 0.1 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + idx * 0.1);
      osc.stop(this.ctx.currentTime + idx * 0.1 + 0.25);
    });
  }
}

const sounds = new SoundManager();

// Hand Evaluator (7-card Texas Hold'em)
class HandEvaluator {
  static evaluate7(cards) {
    if (cards.length < 5) return { rankValue: -1, name: 'Incomplete' };
    const combos = this.combinations(cards, 5);
    let best = null;
    for (const combo of combos) {
      const eval5 = this.evaluate5(combo);
      if (!best || this.compare(eval5, best) > 0) {
        best = eval5;
      }
    }
    return best;
  }

  static combinations(arr, k) {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];
    const head = arr[0];
    const tail = arr.slice(1);
    const withHead = this.combinations(tail, k - 1).map(c => [head, ...c]);
    const withoutHead = this.combinations(tail, k);
    return [...withHead, ...withoutHead];
  }

  static evaluate5(cards) {
    const sorted = [...cards].sort((a, b) => b.val - a.val);
    const vals = sorted.map(c => c.val);
    const isFlush = sorted.every(c => c.suit === sorted[0].suit);
    
    // Check Straight (including A-2-3-4-5 wheel)
    let isStraight = false;
    let straightHigh = vals[0];
    if (
      vals[0] - vals[1] === 1 &&
      vals[1] - vals[2] === 1 &&
      vals[2] - vals[3] === 1 &&
      vals[3] - vals[4] === 1
    ) {
      isStraight = true;
    } else if (
      vals[0] === 14 &&
      vals[1] === 5 &&
      vals[2] === 4 &&
      vals[3] === 3 &&
      vals[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5; // Wheel straight high card is 5
    }

    // Rank counts
    const counts = {};
    vals.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    const freqGroups = Object.keys(counts)
      .map(v => ({ val: Number(v), count: counts[v] }))
      .sort((a, b) => b.count - a.count || b.val - a.val);

    const pattern = freqGroups.map(g => g.count).join('');

    if (isStraight && isFlush) {
      if (straightHigh === 14) {
        return { category: 9, tieBreakers: [14], name: 'Royal Flush' };
      }
      return { category: 8, tieBreakers: [straightHigh], name: `Straight Flush (${this.rankName(straightHigh)} High)` };
    }

    if (pattern === '41') {
      return { category: 7, tieBreakers: [freqGroups[0].val, freqGroups[1].val], name: `Four of a Kind (${this.rankName(freqGroups[0].val)}s)` };
    }

    if (pattern === '32') {
      return { category: 6, tieBreakers: [freqGroups[0].val, freqGroups[1].val], name: `Full House (${this.rankName(freqGroups[0].val)}s full of ${this.rankName(freqGroups[1].val)}s)` };
    }

    if (isFlush) {
      return { category: 5, tieBreakers: vals, name: `Flush (${this.rankName(vals[0])} High)` };
    }

    if (isStraight) {
      return { category: 4, tieBreakers: [straightHigh], name: `Straight (${this.rankName(straightHigh)} High)` };
    }

    if (pattern === '311') {
      return { category: 3, tieBreakers: [freqGroups[0].val, freqGroups[1].val, freqGroups[2].val], name: `Three of a Kind (${this.rankName(freqGroups[0].val)}s)` };
    }

    if (pattern === '221') {
      return { category: 2, tieBreakers: [freqGroups[0].val, freqGroups[1].val, freqGroups[2].val], name: `Two Pair (${this.rankName(freqGroups[0].val)}s & ${this.rankName(freqGroups[1].val)}s)` };
    }

    if (pattern === '2111') {
      return { category: 1, tieBreakers: [freqGroups[0].val, freqGroups[1].val, freqGroups[2].val, freqGroups[3].val], name: `Pair of ${this.rankName(freqGroups[0].val)}s` };
    }

    return { category: 0, tieBreakers: vals, name: `High Card (${this.rankName(vals[0])})` };
  }

  static compare(a, b) {
    if (a.category !== b.category) return a.category - b.category;
    for (let i = 0; i < Math.max(a.tieBreakers.length, b.tieBreakers.length); i++) {
      const tbA = a.tieBreakers[i] || 0;
      const tbB = b.tieBreakers[i] || 0;
      if (tbA !== tbB) return tbA - tbB;
    }
    return 0;
  }

  static rankName(val) {
    const map = { 14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: '10' };
    return map[val] || String(val);
  }

  static getPreFlopTier(holeCards) {
    const c1 = holeCards[0];
    const c2 = holeCards[1];
    const isPair = c1.val === c2.val;
    const isSuited = c1.suit === c2.suit;
    const highVal = Math.max(c1.val, c2.val);
    const lowVal = Math.min(c1.val, c2.val);
    const isConnected = (highVal - lowVal) <= 2;

    if (isPair) {
      if (highVal >= 10) return 'monster'; // TT, JJ, QQ, KK, AA
      if (highVal >= 7) return 'strong';   // 77, 88, 99
      return 'playable';                   // 22, 33, 44, 55, 66 (always playable/set-mining)
    }

    if (highVal === 14) { // Ace high
      if (lowVal >= 12) return isSuited ? 'monster' : 'strong'; // AKs, AQs, AKo, AQo
      if (lowVal >= 10) return 'strong';                        // AJs, ATs, AJo, ATo
      if (isSuited) return 'playable';                          // A2s - A9s
      if (lowVal >= 7) return 'playable';                       // A7o - A9o
      return 'marginal';                                        // A2o - A6o
    }

    if (highVal === 13) { // King high
      if (lowVal >= 10) return 'strong';                        // KQ, KJ, KT
      if (isSuited && lowVal >= 6) return 'playable';           // K6s - K9s
      if (lowVal >= 9) return 'playable';                       // K9o
      if (isSuited) return 'marginal';                          // K2s - K5s
    }

    if (highVal === 12) { // Queen high
      if (lowVal >= 10) return 'strong';                        // QJ, QT
      if (isSuited && lowVal >= 7) return 'playable';           // Q7s - Q9s
      if (lowVal >= 9) return 'playable';                       // Q9o
      if (isSuited) return 'marginal';
    }

    if (highVal === 11) { // Jack high
      if (lowVal >= 9) return 'playable';                       // JT, J9
      if (isSuited && lowVal >= 7) return 'playable';           // J7s, J8s
    }

    // Suited connectors / one-gappers: 54s, 65s, 76s, 87s, 98s, T9s, 86s, 97s, T8s
    if (isSuited && isConnected && lowVal >= 5) {
      return 'playable';
    }

    // Connectors offsuit: 89o, 9To, TJo
    if (isConnected && lowVal >= 8) {
      return 'marginal';
    }

    // Two high cards (both 8+)
    if (lowVal >= 8) {
      return 'marginal';
    }

    return 'trash';
  }

  static evaluatePostFlop(holeCards, communityCards) {
    const allCards = [...holeCards, ...communityCards];
    const evalResult = this.evaluate7(allCards);
    const cat = evalResult.category;
    const maxBoardVal = Math.max(...communityCards.map(c => c.val));

    // Overpair / Top pair detection
    const isPocketPair = holeCards[0].val === holeCards[1].val;
    const isOverpair = isPocketPair && holeCards[0].val > maxBoardVal;
    const isTopPair = cat === 1 && (holeCards[0].val === maxBoardVal || holeCards[1].val === maxBoardVal);
    const isMiddleOrBottomPair = cat === 1 && !isOverpair && !isTopPair;

    // Flush draw: 4 to a suit, and hole card contributes
    let flushDraw = false;
    const suitCounts = {};
    allCards.forEach(c => { suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1; });
    for (const [suit, count] of Object.entries(suitCounts)) {
      if (count === 4 && holeCards.some(c => c.suit === suit)) {
        flushDraw = true;
        break;
      }
    }

    // Straight draw: 4 cards within span <= 4, and hole card contributes
    let straightDraw = false;
    const holeVals = new Set(holeCards.map(c => c.val));
    if (holeVals.has(14)) holeVals.add(1);
    const uniqueVals = [...new Set(allCards.map(c => c.val))].sort((a, b) => a - b);
    if (uniqueVals.includes(14)) uniqueVals.unshift(1);
    for (let i = 0; i <= uniqueVals.length - 4; i++) {
      const window = uniqueVals.slice(i, i + 4);
      if (window[3] - window[0] <= 4) {
        if (window.some(v => holeVals.has(v))) {
          straightDraw = true;
          break;
        }
      }
    }

    // Overcards
    const overcards = holeCards.filter(c => c.val > maxBoardVal).length;

    return {
      cat,
      name: evalResult.name,
      isOverpair,
      isTopPair,
      isMiddleOrBottomPair,
      flushDraw,
      straightDraw,
      overcards
    };
  }

  static hasDraw(cards) {
    if (cards.length < 5) return false;
    // 4 to a flush
    const suitCounts = {};
    cards.forEach(c => { suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1; });
    if (Object.values(suitCounts).some(cnt => cnt >= 4)) return true;

    // 4 to a straight
    const vals = [...new Set(cards.map(c => c.val))].sort((a, b) => a - b);
    if (vals.includes(14)) vals.unshift(1);
    for (let i = 0; i <= vals.length - 4; i++) {
      if (vals[i + 3] - vals[i] <= 4) return true;
    }
    return false;
  }
}

// Game State & Logic
class PokerGame {
  constructor() {
    this.players = [
      { id: 0, name: 'You', isHuman: true, chips: 1000, currentBet: 0, folded: false, allIn: false, holeCards: [] },
      { id: 1, name: 'Bob', isHuman: false, chips: 1000, currentBet: 0, folded: false, allIn: false, holeCards: [] },
      { id: 2, name: 'Alice', isHuman: false, chips: 1000, currentBet: 0, folded: false, allIn: false, holeCards: [] },
      { id: 3, name: 'Charlie', isHuman: false, chips: 1000, currentBet: 0, folded: false, allIn: false, holeCards: [] }
    ];
    this.deck = [];
    this.communityCards = [];
    this.pot = 0;
    this.dealerIdx = 0;
    this.currentTurnIdx = 0;
    this.currentHighestBet = 0;
    this.minRaise = 20;
    this.smallBlind = 10;
    this.bigBlind = 20;
    this.phase = 'IDLE'; // IDLE, PRE-FLOP, FLOP, TURN, RIVER, SHOWDOWN
    this.turnHistoryCount = 0;
    this.lastAggressorIdx = -1;
    this.roundOver = false;
    this.lastWinners = [];
    this.humanRaiseStreak = 0;
    this.humanRaisedThisHand = false;
    this.gameSessionId = 0;
    this.botTimeout = null;
    this.forcedRiverCard = null;

    this.bindDOM();
  }

  bindDOM() {
    this.potDisplay = document.getElementById('pot-amount');
    this.phaseBadge = document.getElementById('game-phase');
    this.communityCardsEl = document.getElementById('community-cards');
    this.startBtn = document.getElementById('start-btn');
    this.resetBtn = document.getElementById('reset-game-btn');
    this.resetAllAltBtn = document.getElementById('reset-everything-btn');
    this.soundBtn = document.getElementById('sound-btn');
    this.startControls = document.getElementById('start-controls');
    this.bettingControls = document.getElementById('betting-controls');
    this.foldBtn = document.getElementById('fold-btn');
    this.checkCallBtn = document.getElementById('check-call-btn');
    this.raiseBtn = document.getElementById('raise-btn');
    this.raiseSlider = document.getElementById('raise-slider');
    this.raiseVal = document.getElementById('raise-val');
    this.handRankDesc = document.getElementById('hand-rank-desc');
    this.logMessages = document.getElementById('log-messages');
    this.logPanel = document.getElementById('log-panel');
    this.logToggleBtn = document.getElementById('log-toggle-btn');
    this.closeLogBtn = document.getElementById('close-log-btn');
    this.liveTicker = document.getElementById('live-ticker');
    this.tickerText = document.getElementById('ticker-text');

    // Chat & River cheat elements
    this.riggedRiverIndicator = document.getElementById('rigged-river-indicator');
    this.riggedCardVal = document.getElementById('rigged-card-val');
    this.cancelRiggedBtn = document.getElementById('cancel-rigged-btn');
    this.chatForm = document.getElementById('chat-form');
    this.chatInput = document.getElementById('chat-input');
    this.chatSendBtn = document.getElementById('chat-send-btn');

    // Unlock audio on first touch/click anywhere (iOS Safari / mobile policy)
    const unlockAudio = () => {
      sounds.init();
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
    document.addEventListener('touchstart', unlockAudio, { passive: true });
    document.addEventListener('click', unlockAudio, { passive: true });

    this.startBtn.addEventListener('click', () => {
      sounds.init();
      this.startNewHand();
    });

    const handleResetAll = () => {
      if (confirm('Reset everything? This will restore all chips to $1,000, wipe the bots\' adapted intelligence back to default, and restart the table.')) {
        this.resetEverything();
      }
    };

    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', handleResetAll);
    }
    if (this.resetAllAltBtn) {
      this.resetAllAltBtn.addEventListener('click', handleResetAll);
    }

    // River cheat indicator & Chat events
    if (this.cancelRiggedBtn) {
      this.cancelRiggedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearCheat();
      });
    }
    if (this.riggedRiverIndicator) {
      this.riggedRiverIndicator.addEventListener('click', () => {
        if (this.logPanel) this.logPanel.classList.add('open');
        if (this.chatInput) this.chatInput.focus();
      });
    }
    if (this.chatForm) {
      this.chatForm.addEventListener('submit', (e) => this.handleChatSubmit(e));
    }

    this.soundBtn.addEventListener('click', () => {
      sounds.enabled = !sounds.enabled;
      this.soundBtn.innerText = sounds.enabled ? '🔊' : '🔇';
    });

    // Mobile Log Drawer / Modal Toggle
    if (this.logToggleBtn) {
      this.logToggleBtn.addEventListener('click', () => {
        this.logPanel.classList.toggle('open');
      });
    }

    if (this.liveTicker) {
      this.liveTicker.addEventListener('click', () => {
        this.logPanel.classList.add('open');
      });
    }

    if (this.closeLogBtn) {
      this.closeLogBtn.addEventListener('click', () => {
        this.logPanel.classList.remove('open');
      });
    }

    this.foldBtn.addEventListener('click', () => this.handleAction('fold'));
    this.checkCallBtn.addEventListener('click', () => this.handleAction('call'));
    this.raiseBtn.addEventListener('click', () => {
      const amount = parseInt(this.raiseSlider.value, 10);
      this.handleAction('raise', amount);
    });

    this.raiseSlider.addEventListener('input', (e) => {
      this.raiseVal.innerText = `$${e.target.value}`;
      this.raiseBtn.innerText = `Raise to $${e.target.value}`;
    });

    document.querySelectorAll('.quick-bet-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.dataset.type;
        this.setQuickBet(type);
      });
    });
  }

  log(msg, type = 'action') {
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.innerText = msg;
    this.logMessages.appendChild(div);
    this.logMessages.scrollTop = this.logMessages.scrollHeight;

    if (this.tickerText) {
      this.tickerText.innerText = msg;
    }
  }

  createDeck() {
    this.deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.deck.push({
          suit: suit.symbol,
          rank: rank.rank,
          val: rank.val,
          color: suit.color
        });
      }
    }
    // Cryptographically fair multi-pass Fisher-Yates shuffle
    for (let pass = 0; pass < 3; pass++) {
      for (let i = this.deck.length - 1; i > 0; i--) {
        const j = getSecureRandomInt(i + 1);
        [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
      }
    }
  }

  startNewHand() {
    this.gameSessionId = (this.gameSessionId || 0) + 1;
    if (this.botTimeout) {
      clearTimeout(this.botTimeout);
      this.botTimeout = null;
    }

    // Check if player has chips
    if (this.players[0].chips <= 0) {
      this.players[0].chips = 500;
      this.log('Re-bought $500 in chips for You!', 'system');
    }
    // Revive bankrupt bots with chips
    this.players.forEach(p => {
      if (p.chips <= 0) p.chips = 500;
    });

    this.dealerIdx = (this.dealerIdx + 1) % this.players.length;
    this.createDeck();
    this.communityCards = [];
    this.pot = 0;
    this.currentHighestBet = 0;
    this.minRaise = this.bigBlind;
    this.roundOver = false;
    this.lastWinners = [];
    document.querySelectorAll('.seat').forEach(s => s.classList.remove('winner-seat', 'active-turn'));

    // Track human aggression over hands
    if (!this.humanRaisedThisHand) {
      this.humanRaiseStreak = Math.max(0, this.humanRaiseStreak - 1);
    }
    this.humanRaisedThisHand = false;

    // Reset player states
    this.players.forEach(p => {
      p.folded = false;
      p.allIn = false;
      p.cardsRevealed = false;
      p.currentBet = 0;
      p.holeCards = [];
    });

    // Deal hole cards in authentic casino rotational order:
    // Round 1: 1 card to each player starting clockwise from Small Blind
    for (let i = 0; i < this.players.length; i++) {
      const pIdx = (this.dealerIdx + 1 + i) % this.players.length;
      this.players[pIdx].holeCards.push(this.deck.pop());
    }
    // Round 2: 2nd card to each player starting clockwise from Small Blind
    for (let i = 0; i < this.players.length; i++) {
      const pIdx = (this.dealerIdx + 1 + i) % this.players.length;
      this.players[pIdx].holeCards.push(this.deck.pop());
    }

    sounds.playCard();
    this.phase = 'PRE-FLOP';
    this.log('--- New Hand Dealt ---', 'system');

    // Post Blinds
    const sbIdx = (this.dealerIdx + 1) % this.players.length;
    const bbIdx = (this.dealerIdx + 2) % this.players.length;
    this.postBet(this.players[sbIdx], this.smallBlind, 'Small Blind');
    this.postBet(this.players[bbIdx], this.bigBlind, 'Big Blind');
    this.currentHighestBet = this.bigBlind;

    // Action starts after BB pre-flop
    this.currentTurnIdx = (bbIdx + 1) % this.players.length;
    this.turnHistoryCount = 0;
    this.lastAggressorIdx = bbIdx;

    this.startControls.style.display = 'none';
    this.updateUI(true); // Initial cards render
    this.nextTurn();
  }

  postBet(player, amount, label = 'Bet') {
    const betAmount = Math.min(player.chips, amount);
    player.chips -= betAmount;
    player.currentBet += betAmount;
    this.pot += betAmount;
    if (player.chips === 0) player.allIn = true;
    sounds.playChip();
    this.log(`${player.name} posts ${label} $${betAmount}`);
  }

  async nextTurn() {
    const sessionId = this.gameSessionId;

    // Check if only 1 active player remains
    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      this.bettingControls.style.display = 'none';
      await sleep(500);
      if (sessionId !== this.gameSessionId) return;
      for (const p of this.players) {
        p.cardsRevealed = true;
      }
      this.updateUI();
      await sleep(700);
      if (sessionId !== this.gameSessionId) return;
      this.awardPot([activePlayers[0]], 'everyone else folded');
      return;
    }

    // Check if betting round is complete
    const eligibleToAct = activePlayers.filter(p => !p.allIn);
    const allBetsEqual = eligibleToAct.every(p => p.currentBet === this.currentHighestBet);

    if (this.turnHistoryCount >= activePlayers.length && (allBetsEqual || eligibleToAct.length <= 1)) {
      await this.advancePhase();
      return;
    }

    // Find next eligible player
    let loops = 0;
    while (loops < this.players.length) {
      const p = this.players[this.currentTurnIdx];
      if (!p.folded && !p.allIn) {
        break;
      }
      this.currentTurnIdx = (this.currentTurnIdx + 1) % this.players.length;
      loops++;
    }

    // If nobody else can act (e.g. all-in), advance to showdown
    if (eligibleToAct.length <= 1 && allBetsEqual) {
      await this.advancePhase();
      return;
    }

    this.turnHistoryCount++;
    this.updateUI();

    const currentPlayer = this.players[this.currentTurnIdx];
    if (currentPlayer.isHuman) {
      this.promptHumanAction();
    } else {
      this.bettingControls.style.display = 'none';
      const callNeeded = this.currentHighestBet - currentPlayer.currentBet;
      let delay = 700 + Math.floor(Math.random() * 500); // 700ms - 1200ms
      if (callNeeded > this.bigBlind) {
        delay += 300 + Math.floor(Math.random() * 400); // Extra pause when facing a raise (simulate thinking)
      }
      if (this.botTimeout) clearTimeout(this.botTimeout);
      this.botTimeout = setTimeout(() => {
        this.botTimeout = null;
        if (sessionId !== this.gameSessionId) return;
        this.botAction(currentPlayer);
      }, delay);
    }
  }

  promptHumanAction() {
    const human = this.players[0];
    this.bettingControls.style.display = 'flex';

    const callAmount = this.currentHighestBet - human.currentBet;
    if (callAmount <= 0) {
      this.checkCallBtn.innerText = 'Check';
      this.checkCallBtn.className = 'btn check-btn';
    } else {
      const needed = Math.min(callAmount, human.chips);
      this.checkCallBtn.innerText = `Call $${needed}`;
      this.checkCallBtn.className = 'btn check-btn';
    }

    // Raise Slider setup
    const minTarget = this.currentHighestBet + this.minRaise;
    const maxTarget = human.chips + human.currentBet;

    if (maxTarget <= this.currentHighestBet) {
      // Human can't raise, only call/all-in
      this.raiseBtn.disabled = true;
      this.raiseSlider.disabled = true;
      this.raiseBtn.innerText = 'Cannot Raise';
    } else {
      this.raiseBtn.disabled = false;
      this.raiseSlider.disabled = false;
      this.raiseSlider.min = Math.min(minTarget, maxTarget);
      this.raiseSlider.max = maxTarget;
      this.raiseSlider.value = Math.min(minTarget, maxTarget);
      this.raiseVal.innerText = `$${this.raiseSlider.value}`;
      this.raiseBtn.innerText = `Raise to $${this.raiseSlider.value}`;
    }
  }

  setQuickBet(type) {
    const human = this.players[0];
    const max = human.chips + human.currentBet;
    const min = Math.min(this.currentHighestBet + this.minRaise, max);

    let target = min;
    if (type === 'half') {
      target = Math.max(min, Math.min(max, Math.floor(this.pot / 2) + this.currentHighestBet));
    } else if (type === 'pot') {
      target = Math.max(min, Math.min(max, this.pot + this.currentHighestBet));
    } else if (type === 'allin') {
      target = max;
    }

    this.raiseSlider.value = target;
    this.raiseVal.innerText = `$${target}`;
    this.raiseBtn.innerText = target === max ? `All-In ($${target})` : `Raise to $${target}`;
  }

  handleAction(action, targetTotalBet = 0) {
    const p = this.players[this.currentTurnIdx];

    if (p.isHuman) {
      if (action === 'raise') {
        this.humanRaisedThisHand = true;
        this.humanRaiseStreak = Math.min(6, this.humanRaiseStreak + 1);
      } else if (action === 'fold') {
        if (!this.humanRaisedThisHand) {
          this.humanRaiseStreak = Math.max(0, this.humanRaiseStreak - 1);
        }
      }
    }

    if (action === 'fold') {
      p.folded = true;
      this.log(`${p.name} folds.`);
    } else if (action === 'call') {
      const needed = this.currentHighestBet - p.currentBet;
      if (needed <= 0) {
        this.log(`${p.name} checks.`);
      } else {
        const bet = Math.min(needed, p.chips);
        p.chips -= bet;
        p.currentBet += bet;
        this.pot += bet;
        if (p.chips === 0) p.allIn = true;
        sounds.playChip();
        this.log(`${p.name} calls $${bet}.`);
      }
    } else if (action === 'raise') {
      this.lastAggressorIdx = this.currentTurnIdx;
      const added = targetTotalBet - p.currentBet;
      const actualAdded = Math.min(added, p.chips);
      p.chips -= actualAdded;
      p.currentBet += actualAdded;
      this.pot += actualAdded;
      
      const raiseDiff = p.currentBet - this.currentHighestBet;
      if (raiseDiff > this.minRaise) {
        this.minRaise = raiseDiff;
      }
      this.currentHighestBet = p.currentBet;
      if (p.chips === 0) p.allIn = true;
      sounds.playChip();
      this.log(`${p.name} raises to $${p.currentBet}!`);
      this.turnHistoryCount = 1; // Reset round turn counter on raise
    }

    this.currentTurnIdx = (this.currentTurnIdx + 1) % this.players.length;
    this.nextTurn();
  }

  botAction(bot) {
    const callNeeded = this.currentHighestBet - bot.currentBet;
    const isPreFlop = this.phase === 'PRE-FLOP';
    const isManiac = this.humanRaiseStreak >= 1;
    const isExtremeManiac = this.humanRaiseStreak >= 3;
    const isBlind = bot.currentBet > 0;
    const maxTotalBet = bot.chips + bot.currentBet;

    const tryRaise = (multiplier = 1.5) => {
      const minTarget = this.currentHighestBet + this.minRaise;
      if (maxTotalBet >= minTarget) {
        const targetRaise = Math.min(maxTotalBet, this.currentHighestBet + Math.max(this.minRaise, Math.round(this.minRaise * multiplier)));
        this.handleAction('raise', targetRaise);
      } else {
        this.handleAction('call'); // Go all-in / call
      }
    };

    if (isPreFlop) {
      const tier = HandEvaluator.getPreFlopTier(bot.holeCards);

      if (callNeeded === 0) {
        // Can check for free (e.g. Big Blind in limped pot)
        if (tier === 'monster') {
          Math.random() < 0.65 ? tryRaise(2.0) : this.handleAction('call');
        } else if (tier === 'strong') {
          Math.random() < 0.4 ? tryRaise(1.5) : this.handleAction('call');
        } else if (tier === 'playable' && bot.name === 'Bob' && Math.random() < 0.25) {
          tryRaise(1.0);
        } else {
          this.handleAction('call'); // Check
        }
        return;
      }

      // Unraised pot or completing blind ($10 or $20)
      if (callNeeded <= this.bigBlind) {
        if (tier === 'monster') {
          Math.random() < 0.7 ? tryRaise(2.5) : this.handleAction('call');
        } else if (tier === 'strong') {
          Math.random() < 0.45 ? tryRaise(2.0) : this.handleAction('call');
        } else if (tier === 'playable') {
          this.handleAction('call');
        } else if (tier === 'marginal') {
          // Blinds, Bob, and Charlie play marginal hands in unraised pots
          if (isBlind || bot.name !== 'Alice' || Math.random() < 0.6) {
            this.handleAction('call');
          } else {
            this.handleAction('fold');
          }
        } else {
          // Trash hands fold unless in Small Blind getting 3:1 pot odds
          if (isBlind && Math.random() < 0.35) {
            this.handleAction('call');
          } else {
            this.handleAction('fold');
          }
        }
        return;
      }

      // Facing a pre-flop RAISE (callNeeded > bigBlind)
      if (tier === 'monster') {
        // AA, KK, QQ, JJ, TT, AK, AQs
        // If human is maniac, 3-bet aggressively; else mix 3-bet and call/trap
        const reRaiseChance = isManiac ? 0.75 : 0.55;
        if (Math.random() < reRaiseChance && maxTotalBet >= this.currentHighestBet + this.minRaise) {
          tryRaise(isManiac ? 2.5 : 2.0);
        } else {
          this.handleAction('call');
        }
      } else if (tier === 'strong') {
        // 77-99, AQ, AJ, AT, KQ, KJ, QJ
        // Defend against raises up to 5x BB or 40% stack
        if (callNeeded <= Math.max(this.bigBlind * 5, bot.chips * 0.4)) {
          // 3-bet if human is a maniac or Bob
          if (isManiac && Math.random() < 0.4 && maxTotalBet >= this.currentHighestBet + this.minRaise) {
            tryRaise(2.0);
          } else {
            this.handleAction('call');
          }
        } else if (isManiac && callNeeded <= bot.chips * 0.6) {
          this.handleAction('call');
        } else {
          this.handleAction('fold');
        }
      } else if (tier === 'playable') {
        // 22-66, suited aces, Broadway, suited connectors
        // Pocket pairs (22-66) ALWAYS set-mine on standard raises
        const isPocketPair = bot.holeCards[0].val === bot.holeCards[1].val;
        const maxStandardCall = isPocketPair ? this.bigBlind * 5 : this.bigBlind * 4;

        if (callNeeded <= maxStandardCall || (isManiac && callNeeded <= bot.chips * 0.35)) {
          if (isManiac && bot.name === 'Bob' && Math.random() < 0.25 && maxTotalBet >= this.currentHighestBet + this.minRaise) {
            tryRaise(1.5); // Squeeze / 3-bet bluff against serial raiser
          } else {
            this.handleAction('call');
          }
        } else if (isBlind && callNeeded <= this.bigBlind * 5) {
          this.handleAction('call'); // Defend blind
        } else {
          this.handleAction('fold');
        }
      } else if (tier === 'marginal') {
        // Connectors, suited cards, two cards >= 8
        if (isManiac) {
          // Bully defense: Bots refuse to get run over!
          const callChance = bot.name === 'Bob' ? 0.75 : (bot.name === 'Charlie' ? 0.65 : 0.45);
          if (Math.random() < callChance && callNeeded <= Math.max(this.bigBlind * 4, bot.chips * 0.3)) {
            this.handleAction('call');
          } else {
            this.handleAction('fold');
          }
        } else if (isBlind && callNeeded <= this.bigBlind * 2.5) {
          this.handleAction('call');
        } else {
          this.handleAction('fold');
        }
      } else {
        // Trash
        if (isExtremeManiac && bot.name === 'Bob' && Math.random() < 0.2 && callNeeded <= this.bigBlind * 3) {
          this.handleAction('call');
        } else {
          this.handleAction('fold');
        }
      }
      return;
    }

    // Post-Flop evaluation (Flop, Turn, River)
    const pf = HandEvaluator.evaluatePostFlop(bot.holeCards, this.communityCards);
    const cat = pf.cat;
    const pot = Math.max(1, this.pot);
    const betToPotRatio = callNeeded / pot;

    if (callNeeded === 0) {
      // Free check available
      if (cat >= 3) {
        // Monster: bet 65% of the time, slow-play check 35%
        Math.random() < 0.65 ? tryRaise(2.0) : this.handleAction('call');
      } else if (cat === 2) {
        // Two pair: bet 55%
        Math.random() < 0.55 ? tryRaise(1.5) : this.handleAction('call');
      } else if (cat === 1) {
        if (pf.isOverpair || pf.isTopPair) {
          // Top pair/overpair: value bet 50%
          Math.random() < 0.5 ? tryRaise(1.2) : this.handleAction('call');
        } else {
          // Middle/bottom pair: check 80%, stab 20%
          Math.random() < 0.2 ? tryRaise(1.0) : this.handleAction('call');
        }
      } else if (pf.flushDraw || pf.straightDraw) {
        // Semi-bluff with draws
        (bot.name === 'Bob' && Math.random() < 0.4) ? tryRaise(1.2) : this.handleAction('call');
      } else {
        // High card: Bob bluffs 12%, otherwise check
        (bot.name === 'Bob' && Math.random() < 0.12) ? tryRaise(1.0) : this.handleAction('call');
      }
      return;
    }

    // Facing a bet/raise post-flop (callNeeded > 0)
    if (cat >= 3) {
      // Monster hand (Trips, Straight, Flush, Full House+)
      // Punish aggressive human with 3-bets / re-raises
      const reRaiseChance = isManiac ? 0.65 : 0.45;
      if (Math.random() < reRaiseChance && maxTotalBet >= this.currentHighestBet + this.minRaise) {
        tryRaise(2.0);
      } else {
        this.handleAction('call');
      }
    } else if (cat === 2) {
      // Two Pair
      if (isManiac && Math.random() < 0.45 && maxTotalBet >= this.currentHighestBet + this.minRaise) {
        tryRaise(1.8);
      } else if (callNeeded <= bot.chips * 0.85) {
        this.handleAction('call');
      } else {
        this.handleAction('fold');
      }
    } else if (cat === 1) {
      // One pair
      if (pf.isOverpair || pf.isTopPair) {
        // Overpair or Top Pair: Strong!
        if (isManiac) {
          // Against a serial raiser, top pair is practically the nuts
          if (Math.random() < 0.35 && maxTotalBet >= this.currentHighestBet + this.minRaise) {
            tryRaise(1.5); // Re-raise the bluffer!
          } else {
            this.handleAction('call');
          }
        } else if (betToPotRatio <= 1.2 || callNeeded <= bot.chips * 0.5) {
          this.handleAction('call');
        } else {
          this.handleAction('fold');
        }
      } else {
        // Middle or Bottom pair
        if (isManiac) {
          // Call down the serial raiser with any pair up to 85% pot
          if (betToPotRatio <= 0.85 || bot.name === 'Charlie' || callNeeded <= this.bigBlind * 4) {
            this.handleAction('call');
          } else {
            this.handleAction('fold');
          }
        } else if (betToPotRatio <= 0.45 || callNeeded <= this.bigBlind * 2.5) {
          this.handleAction('call');
        } else {
          this.handleAction('fold');
        }
      }
    } else if (pf.flushDraw || pf.straightDraw) {
      // Big draws (Flush / Straight draw)
      if (this.phase !== 'RIVER') {
        // Still cards to come! Good pot odds to call
        const maxDrawCallRatio = isManiac ? 0.85 : 0.65;
        if (betToPotRatio <= maxDrawCallRatio || callNeeded <= this.bigBlind * 4) {
          // Bob might semi-bluff raise with a draw
          if (bot.name === 'Bob' && Math.random() < 0.25 && maxTotalBet >= this.currentHighestBet + this.minRaise) {
            tryRaise(1.5);
          } else {
            this.handleAction('call');
          }
        } else {
          this.handleAction('fold');
        }
      } else {
        // Missed draw on river
        this.handleAction('fold');
      }
    } else if (pf.overcards >= 2 && this.phase === 'FLOP' && isManiac && betToPotRatio <= 0.45) {
      // 2 overcards (e.g. AK on low board) floating the flop against a maniac
      this.handleAction('call');
    } else {
      // Pure air (no pair, no draw)
      if (isManiac && bot.name === 'Bob' && Math.random() < 0.2 && callNeeded <= this.bigBlind * 2) {
        this.handleAction('call'); // Bob float/hero-call
      } else {
        this.handleAction('fold');
      }
    }
  }

  async advancePhase() {
    const sessionId = this.gameSessionId;

    // Hide controls during card dealing
    this.bettingControls.style.display = 'none';

    // Reset bets for active players
    this.players.forEach(p => { p.currentBet = 0; });
    this.currentHighestBet = 0;
    this.minRaise = this.bigBlind;
    this.turnHistoryCount = 0;
    this.updateUI(false);

    if (this.phase === 'PRE-FLOP') {
      this.phase = 'FLOP';
      this.deck.pop(); // Burn card
      this.log('--- Dealing Flop ---', 'system');
      this.updateUI(false);
      await sleep(500);
      if (sessionId !== this.gameSessionId) return;

      // Card 1
      this.communityCards.push(this.deck.pop());
      sounds.playCard();
      this.updateUI(true);
      await sleep(400);
      if (sessionId !== this.gameSessionId) return;

      // Card 2
      this.communityCards.push(this.deck.pop());
      sounds.playCard();
      this.updateUI(true);
      await sleep(400);
      if (sessionId !== this.gameSessionId) return;

      // Card 3
      this.communityCards.push(this.deck.pop());
      sounds.playCard();
      this.updateUI(true);
      await sleep(750); // Pause to assess the full flop
      if (sessionId !== this.gameSessionId) return;
    } else if (this.phase === 'FLOP') {
      this.phase = 'TURN';
      this.deck.pop(); // Burn card
      this.log('--- Dealing Turn ---', 'system');
      this.updateUI(false);
      await sleep(850); // Suspenseful pause before the Turn!
      if (sessionId !== this.gameSessionId) return;

      this.communityCards.push(this.deck.pop());
      sounds.playCard();
      this.updateUI(true);
      await sleep(750);
      if (sessionId !== this.gameSessionId) return;
    } else if (this.phase === 'TURN') {
      this.phase = 'RIVER';
      this.deck.pop(); // Burn card
      this.log('--- Dealing River ---', 'system');
      this.updateUI(false);
      await sleep(950); // Suspenseful pause before the River!
      if (sessionId !== this.gameSessionId) return;

      let riverCard;
      if (this.forcedRiverCard) {
        const idx = this.deck.findIndex(c => c.suit === this.forcedRiverCard.suit && c.val === this.forcedRiverCard.val);
        if (idx !== -1) {
          riverCard = this.deck.splice(idx, 1)[0];
        } else {
          riverCard = { ...this.forcedRiverCard };
        }
        this.log(`🤫 River dealt: ${riverCard.rank}${riverCard.suit} (Rigged)!`, 'winner');
        this.forcedRiverCard = null;
        this.updateCheatIndicator();
      } else {
        riverCard = this.deck.pop();
      }

      this.communityCards.push(riverCard);
      sounds.playCard();
      this.updateUI(true);
      await sleep(800);
      if (sessionId !== this.gameSessionId) return;
    } else if (this.phase === 'RIVER') {
      this.phase = 'SHOWDOWN';
      await this.showdown();
      return;
    }

    // Next round starts with player to the left of dealer
    this.currentTurnIdx = (this.dealerIdx + 1) % this.players.length;
    this.updateUI(false);
    this.nextTurn();
  }

  async showdown() {
    const sessionId = this.gameSessionId;
    this.bettingControls.style.display = 'none';
    this.phase = 'SHOWDOWN';
    this.updateUI();
    this.log('=== SHOWDOWN ===', 'system');
    await sleep(700);
    if (sessionId !== this.gameSessionId) return;

    const activePlayers = this.players.filter(p => !p.folded);

    // Dramatically reveal each bot's cards one by one!
    for (const p of this.players) {
      if (!p.isHuman) {
        p.cardsRevealed = true;
        sounds.playCard();
        this.updateUI();

        if (!p.folded) {
          const evalResult = HandEvaluator.evaluate7([...p.holeCards, ...this.communityCards]);
          this.log(`${p.name} reveals: ${evalResult.name}`);
        } else {
          this.log(`${p.name} had folded.`);
        }
        await sleep(900); // Dramatic pause per bot reveal!
        if (sessionId !== this.gameSessionId) return;
      }
    }

    this.log('Determining the winner...', 'system');
    await sleep(850); // Final suspense pause!
    if (sessionId !== this.gameSessionId) return;

    const results = activePlayers.map(p => {
      const evalResult = HandEvaluator.evaluate7([...p.holeCards, ...this.communityCards]);
      return { player: p, eval: evalResult };
    });

    results.sort((a, b) => HandEvaluator.compare(b.eval, a.eval));

    // Find winners (handle ties)
    const bestEval = results[0].eval;
    const winners = results.filter(r => HandEvaluator.compare(r.eval, bestEval) === 0).map(r => r.player);

    this.awardPot(winners, bestEval.name);
  }

  awardPot(winners, reason) {
    sounds.playWin();
    const share = Math.floor(this.pot / winners.length);
    const names = winners.map(w => w.name).join(' & ');
    winners.forEach(w => {
      w.chips += share;
      const seat = document.getElementById(`seat-${w.id}`);
      if (seat) seat.classList.add('winner-seat');
    });

    this.log(`🏆 ${names} won $${this.pot} with ${reason}!`, 'winner');

    this.pot = 0;
    this.phase = 'IDLE';
    this.roundOver = true;
    this.lastWinners = winners;
    this.forcedRiverCard = null;
    this.updateCheatIndicator();
    this.bettingControls.style.display = 'none';
    this.startControls.style.display = 'flex';
    this.startBtn.innerText = 'Next Hand';
    this.updateUI(true);
  }

  resetEverything() {
    // 1. Invalidate any in-flight asynchronous deals / reveals / bot actions
    this.gameSessionId = (this.gameSessionId || 0) + 1;
    if (this.botTimeout) {
      clearTimeout(this.botTimeout);
      this.botTimeout = null;
    }

    // 2. Wipe bot adaptive intelligence & table memory completely back to 0
    this.humanRaiseStreak = 0;
    this.humanRaisedThisHand = false;

    // 3. Reset chips & player state
    this.players.forEach(p => {
      p.chips = 1000;
      p.currentBet = 0;
      p.folded = false;
      p.allIn = false;
      p.holeCards = [];
      p.cardsRevealed = false;
    });

    // 4. Reset table and game loop state
    this.deck = [];
    this.communityCards = [];
    this.pot = 0;
    this.dealerIdx = 0;
    this.currentTurnIdx = 0;
    this.currentHighestBet = 0;
    this.minRaise = this.bigBlind;
    this.phase = 'IDLE';
    this.turnHistoryCount = 0;
    this.lastAggressorIdx = -1;
    this.roundOver = false;
    this.lastWinners = [];

    // 5. Clean up UI elements
    document.querySelectorAll('.seat').forEach(s => {
      s.classList.remove('winner-seat', 'active-turn');
    });

    this.bettingControls.style.display = 'none';
    this.startControls.style.display = 'flex';
    this.startBtn.innerText = 'Start Hand';
    if (this.handRankDesc) {
      this.handRankDesc.innerText = 'Click Start Hand to begin';
    }

    // 6. Refresh UI table elements (re-renders empty community slots and clears player cards)
    this.updateUI(true);

    // 7. Audio & feedback
    sounds.playChip();
    this.log('🔄 Game reset: All chips ($1,000) and bot memory/adaptive intelligence cleared to default.', 'system');
    if (this.tickerText) {
      this.tickerText.innerText = 'Game reset: All chips and bot intelligence restored.';
    }

    // 8. Clear cheat state
    this.forcedRiverCard = null;
    this.updateCheatIndicator();
  }

  // --- TABLE CHAT & CHEAT ENGINE (##force AS) ---

  parseCheatCard(str) {
    if (!str || typeof str !== 'string') return null;
    const clean = str.trim();
    // Match rank (10, T, A, K, Q, J, 2-9) and suit (S, H, D, C or unicode ♠, ♥, ♦, ♣)
    const match = clean.match(/^([2-9]|10|[AKQJT])\s*([SHDC♠♥♦♣])$/i);
    if (!match) return null;

    let rankStr = match[1].toUpperCase();
    if (rankStr === 'T') rankStr = '10';

    const suitChar = match[2].toUpperCase();
    let suitSymbol = '♠';
    let suitColor = 'black';

    if (suitChar === 'S' || suitChar === '♠') {
      suitSymbol = '♠';
      suitColor = 'black';
    } else if (suitChar === 'H' || suitChar === '♥') {
      suitSymbol = '♥';
      suitColor = 'red';
    } else if (suitChar === 'D' || suitChar === '♦') {
      suitSymbol = '♦';
      suitColor = 'red';
    } else if (suitChar === 'C' || suitChar === '♣') {
      suitSymbol = '♣';
      suitColor = 'black';
    } else {
      return null;
    }

    const rankObj = RANKS.find(r => r.rank === rankStr);
    if (!rankObj) return null;

    return {
      rank: rankStr,
      val: rankObj.val,
      suit: suitSymbol,
      color: suitColor
    };
  }

  handleChatSubmit(e) {
    if (e) e.preventDefault();
    if (!this.chatInput) return;
    const text = this.chatInput.value.trim();
    if (!text) return;
    this.chatInput.value = '';

    // Check if command: starts with ##, #, or /
    if (/^(?:##|#|\/)/.test(text)) {
      this.handleChatCommand(text);
    } else {
      // Normal chat message
      this.appendChatMessage('You', text, 'chat-human');
      this.triggerBotChatReply(text);
    }
  }

  handleChatCommand(rawCmd) {
    // Show the command in chat log
    this.log(rawCmd, 'cheat-cmd');

    const clean = rawCmd.trim().replace(/^(?:##|#|\/)/, '').trim();
    const parts = clean.split(/\s+/);
    const action = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').trim();

    if (action === 'force') {
      if (!arg) {
        this.log('Usage: ##force <Card> (e.g. ##force AS, ##force 10H, ##force KD, ##force 2C) or ##force best', 'system');
        return;
      }

      if (arg.toLowerCase() === 'best' || arg.toLowerCase() === 'auto') {
        const best = this.findBestRiverCardForHuman();
        if (!best || !best.card) {
          this.log('Cannot auto-detect best card: Start a hand and deal cards first!', 'system');
          return;
        }
        this.applyForcedCard(best.card, `✨ Auto-best: ${best.eval ? best.eval.name : ''}`);
        return;
      }

      const card = this.parseCheatCard(arg);
      if (!card) {
        this.log(`❌ Invalid card "${arg}". Format: [Rank][Suit] e.g. ##force AS, ##force 10H, ##force 7D, ##force 2C`, 'system');
        return;
      }

      this.applyForcedCard(card);
    } else if (action === 'clear' || action === 'unforce' || action === 'fair' || action === 'reset') {
      this.clearCheat();
    } else if (action === 'help') {
      this.log('🃏 Commands:\n• ##force AS (Force Ace of Spades on river)\n• ##force 10H (Force 10 of Hearts)\n• ##force best (Auto-pick best winning river card)\n• ##clear (Cancel forced card)', 'system');
    } else {
      // Check if user typed card shorthand directly e.g. ##AS or #10H
      const directCard = this.parseCheatCard(clean);
      if (directCard) {
        this.applyForcedCard(directCard);
      } else {
        this.log(`Unknown command "${rawCmd}". Type ##help or ##force AS.`, 'system');
      }
    }
  }

  applyForcedCard(card, extraNote = '') {
    if (this.communityCards.length >= 5) {
      // River already dealt on table: immediately swap it!
      this.swapRiverCard(card, extraNote);
      return;
    }

    this.forcedRiverCard = { ...card };
    this.updateCheatIndicator();
    sounds.playChip();
    const note = extraNote ? ` (${extraNote})` : '';
    this.log(`🤫 River locked to ${card.rank}${card.suit}!${note}`, 'winner');
  }

  swapRiverCard(card, extraNote = '') {
    if (this.communityCards.length < 5) {
      this.forcedRiverCard = card;
      this.updateCheatIndicator();
      return;
    }

    const oldCard = this.communityCards[4];
    this.deck.push(oldCard);
    const idx = this.deck.findIndex(c => c.suit === card.suit && c.val === card.val);
    if (idx !== -1) {
      this.communityCards[4] = this.deck.splice(idx, 1)[0];
    } else {
      this.communityCards[4] = { ...card };
    }

    sounds.playCard();
    const note = extraNote ? ` (${extraNote})` : '';
    this.log(`🤫 River card replaced with ${card.rank}${card.suit}!${note}`, 'winner');
    this.forcedRiverCard = null;
    this.updateCheatIndicator();
    this.updateUI(true);

    const human = this.players[0];
    if (human && human.holeCards.length === 2) {
      const evalRes = HandEvaluator.evaluate7([...human.holeCards, ...this.communityCards]);
      if (this.handRankDesc) {
        this.handRankDesc.innerText = `Your Hand: ${evalRes.name}`;
      }
    }
  }

  clearCheat() {
    this.forcedRiverCard = null;
    this.updateCheatIndicator();
    this.log('Cheat cleared: River will be dealt fairly.', 'system');
  }

  updateCheatIndicator() {
    if (!this.riggedRiverIndicator) return;
    if (this.forcedRiverCard && this.communityCards.length < 5) {
      this.riggedRiverIndicator.style.display = 'inline-flex';
      if (this.riggedCardVal) {
        this.riggedCardVal.innerText = `${this.forcedRiverCard.rank}${this.forcedRiverCard.suit}`;
        if (this.forcedRiverCard.color === 'red') {
          this.riggedCardVal.classList.add('red');
        } else {
          this.riggedCardVal.classList.remove('red');
        }
      }
    } else {
      this.riggedRiverIndicator.style.display = 'none';
    }
  }

  findBestRiverCardForHuman() {
    const human = this.players[0];
    if (!human || human.holeCards.length < 2) return null;

    const usedKeys = new Set();
    human.holeCards.forEach(c => usedKeys.add(`${c.val}_${c.suit}`));
    const baseBoard = this.communityCards.slice(0, 4);
    baseBoard.forEach(c => usedKeys.add(`${c.val}_${c.suit}`));

    const candidates = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        if (!usedKeys.has(`${rank.val}_${suit.symbol}`)) {
          candidates.push({
            suit: suit.symbol,
            rank: rank.rank,
            val: rank.val,
            color: suit.color
          });
        }
      }
    }

    if (candidates.length === 0) return null;

    const activeBots = this.players.filter(p => !p.isHuman && !p.folded && p.holeCards.length === 2);

    let bestCard = null;
    let bestScore = null;
    let bestHumanEval = null;

    for (const card of candidates) {
      const testBoard = [...baseBoard, card];
      let padIdx = 0;
      while (testBoard.length < 5 && padIdx < candidates.length) {
        const dummy = candidates[padIdx++];
        if (dummy !== card && !testBoard.includes(dummy)) {
          testBoard.push(dummy);
        }
      }

      const humanEval = HandEvaluator.evaluate7([...human.holeCards, ...testBoard]);

      let beatsBots = true;
      for (const bot of activeBots) {
        const botEval = HandEvaluator.evaluate7([...bot.holeCards, ...testBoard]);
        if (HandEvaluator.compare(humanEval, botEval) <= 0) {
          beatsBots = false;
          break;
        }
      }

      if (!bestCard) {
        bestCard = card;
        bestHumanEval = humanEval;
        bestScore = { beatsBots, eval: humanEval };
      } else {
        if (beatsBots && !bestScore.beatsBots) {
          bestCard = card;
          bestHumanEval = humanEval;
          bestScore = { beatsBots, eval: humanEval };
        } else if (beatsBots === bestScore.beatsBots) {
          if (HandEvaluator.compare(humanEval, bestScore.eval) > 0) {
            bestCard = card;
            bestHumanEval = humanEval;
            bestScore = { beatsBots, eval: humanEval };
          }
        }
      }
    }

    return { card: bestCard, eval: bestHumanEval, beatsBots: bestScore ? bestScore.beatsBots : false };
  }

  appendChatMessage(sender, text, className) {
    const div = document.createElement('div');
    div.className = `log-entry ${className}`;
    const strong = document.createElement('strong');
    strong.innerText = `${sender}: `;
    const span = document.createElement('span');
    span.innerText = text;
    div.appendChild(strong);
    div.appendChild(span);
    this.logMessages.appendChild(div);
    this.logMessages.scrollTop = this.logMessages.scrollHeight;

    if (this.tickerText) {
      this.tickerText.innerText = `${sender}: ${text}`;
    }
  }

  triggerBotChatReply(userMessage) {
    const activeBots = this.players.filter(p => !p.isHuman && p.chips > 0);
    if (activeBots.length === 0) return;

    const bot = activeBots[Math.floor(Math.random() * activeBots.length)];
    const lower = userMessage.toLowerCase();

    let reply = '';
    if (lower.includes('cheat') || lower.includes('force') || lower.includes('rig') || lower.includes('hack')) {
      const cheatReplies = [
        "Hey... did the dealer just wink at you?",
        "Are you sliding cards out of your sleeve?!",
        "The probability of that hand is statistically suspicious...",
        "I'm keeping my eyes on your hands!"
      ];
      reply = cheatReplies[Math.floor(Math.random() * cheatReplies.length)];
    } else if (lower.includes('all in') || lower.includes('all-in') || lower.includes('shove')) {
      const allInReplies = [
        "Big talk for a big bet! Let's see it.",
        "You're either holding the nuts or a huge bluff.",
        "Gutsy move! Let's see how the cards fall."
      ];
      reply = allInReplies[Math.floor(Math.random() * allInReplies.length)];
    } else if (lower.includes('fold') || lower.includes('give up')) {
      reply = bot.name === 'Alice' ? "Fold? Never in my playbook!" : "I only fold when the math commands it.";
    } else if (lower.includes('win') || lower.includes('gg') || lower.includes('good game')) {
      reply = "The hand's not over till the river sings!";
    } else {
      // Persona-specific banter
      if (bot.name === 'Alice') {
        const aliceLines = [
          "Talk is cheap, let's see some chips!",
          "Don't get too comfortable, I'm gunning for your stack.",
          "Aggression wins pots, remember that."
        ];
        reply = aliceLines[Math.floor(Math.random() * aliceLines.length)];
      } else if (bot.name === 'Bob') {
        const bobLines = [
          "My pot odds calculations are never wrong.",
          "Variance is real, but discipline prevails.",
          "Statistically, I have a favorable expectation here."
        ];
        reply = bobLines[Math.floor(Math.random() * bobLines.length)];
      } else {
        const charlieLines = [
          "I have no idea what I have, but I'm having a blast!",
          "Any two cards can win, right?!",
          "Let's gamble! Yeehaw!"
        ];
        reply = charlieLines[Math.floor(Math.random() * charlieLines.length)];
      }
    }

    setTimeout(() => {
      this.appendChatMessage(bot.name, reply, 'chat-bot');
    }, 600 + Math.random() * 600);
  }

  updateUI(refreshCards = false) {
    this.potDisplay.innerText = `$${this.pot}`;
    this.phaseBadge.innerText = this.phase;

    // Render Community Cards ONLY when explicitly asked (dealing phases or new hand)
    if (refreshCards) {
      this.communityCardsEl.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        if (this.communityCards[i]) {
          this.communityCardsEl.appendChild(this.renderCardDOM(this.communityCards[i]));
        } else {
          const slot = document.createElement('div');
          slot.className = 'card-slot';
          this.communityCardsEl.appendChild(slot);
        }
      }
    }

    // Render Players
    this.players.forEach(p => {
      const seat = document.getElementById(`seat-${p.id}`);
      const chipsEl = document.getElementById(`chips-${p.id}`);
      const betEl = document.getElementById(`bet-${p.id}`);
      const dealerEl = document.getElementById(`dealer-${p.id}`);
      const statusEl = document.getElementById(`status-${p.id}`);
      const cardsEl = document.getElementById(`cards-${p.id}`);

      chipsEl.innerText = `$${p.chips}`;

      if (p.currentBet > 0) {
        betEl.innerText = `$${p.currentBet}`;
        betEl.classList.add('show');
      } else {
        betEl.classList.remove('show');
      }

      if (this.dealerIdx === p.id) {
        dealerEl.classList.add('show');
      } else {
        dealerEl.classList.remove('show');
      }

      // Active Turn Indicator
      if (this.phase !== 'IDLE' && this.phase !== 'SHOWDOWN' && this.currentTurnIdx === p.id && !p.folded) {
        seat.classList.add('active-turn');
      } else {
        seat.classList.remove('active-turn');
      }

      // Status text
      if (p.folded) {
        if (statusEl) {
          statusEl.innerText = 'Folded';
          statusEl.className = 'player-status folded';
        }
        // Mark folded cards without rebuilding DOM
        cardsEl.querySelectorAll('.card').forEach(c => c.classList.add('card-folded'));
      } else if (p.allIn) {
        if (statusEl) {
          statusEl.innerText = 'All-In';
          statusEl.className = 'player-status';
        }
      } else if (statusEl) {
        if (this.roundOver) {
          const isWinner = this.lastWinners && this.lastWinners.some(w => w.id === p.id);
          if (this.communityCards.length >= 3) {
            const evalResult = HandEvaluator.evaluate7([...p.holeCards, ...this.communityCards]);
            statusEl.innerText = isWinner ? `🏆 ${evalResult.name}` : evalResult.name;
            statusEl.className = isWinner ? 'player-status winner-text' : 'player-status';
          } else {
            statusEl.innerText = isWinner ? '🏆 Winner' : 'Active';
            statusEl.className = isWinner ? 'player-status winner-text' : 'player-status';
          }
        } else if (p.cardsRevealed && this.communityCards.length >= 3) {
          const evalResult = HandEvaluator.evaluate7([...p.holeCards, ...this.communityCards]);
          statusEl.innerText = evalResult.name;
          statusEl.className = 'player-status';
        } else {
          statusEl.innerText = this.phase === 'IDLE' ? 'Ready' : 'In Hand';
          statusEl.className = 'player-status';
        }
      }

      // Cards rendering: Rebuild cards ONLY when refreshCards is true (deal, flop, turn, river, showdown)
      if (refreshCards) {
        cardsEl.innerHTML = '';
        if (p.holeCards.length > 0) {
          if (p.isHuman || this.roundOver || p.cardsRevealed) {
            p.holeCards.forEach(c => {
              const cardEl = this.renderCardDOM(c);
              if (p.folded) {
                cardEl.classList.add('card-folded');
              }
              cardsEl.appendChild(cardEl);
            });
          } else {
            // Face-down bot cards during active play
            cardsEl.appendChild(this.renderCardDOM(null, true));
            cardsEl.appendChild(this.renderCardDOM(null, true));
          }
        }
      }
    });

    // Update Human Hand Evaluation Preview
    const human = this.players[0];
    if (human.holeCards.length > 0 && !human.folded) {
      const allVisible = [...human.holeCards, ...this.communityCards];
      if (allVisible.length >= 5) {
        const evalResult = HandEvaluator.evaluate7(allVisible);
        this.handRankDesc.innerText = evalResult.name;
        this.handRankDesc.style.display = 'block';
      } else {
        this.handRankDesc.innerText = 'Pre-Flop';
        this.handRankDesc.style.display = 'block';
      }
    } else {
      this.handRankDesc.style.display = 'none';
    }
  }

  renderCardDOM(card, isBack = false) {
    const cardEl = document.createElement('div');
    if (isBack) {
      cardEl.className = 'card back';
      return cardEl;
    }

    cardEl.className = `card ${card.color}`;
    cardEl.innerHTML = `
      <div class="card-corner top-left">
        <span class="rank">${card.rank}</span>
        <span class="suit">${card.suit}</span>
      </div>
      <div class="card-center">${card.suit}</div>
      <div class="card-corner bottom-right">
        <span class="rank">${card.rank}</span>
        <span class="suit">${card.suit}</span>
      </div>
    `;
    return cardEl;
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  window.pokerGame = new PokerGame();
});
