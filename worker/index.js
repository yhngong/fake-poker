// --- Cloudflare Workers Backend for Fake Poker (Multiplayer Texas Hold'em) ---
// Supports multiple concurrent human players via WebSockets & Durable Objects.
// Free seats are automatically filled by bots (Alice, Bob, Charlie).

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

const BRIBE_COSTS = {
  PEEK: 250,
  SPECIFIC_CARD: 500,
  BEST_CARD: 750
};

const DEFAULT_CHIPS = 1000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;

// Authoritative 7-card Hand Evaluator
class HandEvaluator {
  static evaluate7(cards) {
    if (!cards || cards.length < 5) return { rankValue: -1, name: 'Incomplete' };
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
}

// Durable Object: Poker Room State & WebSocket Hub
export class PokerRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // ws -> session object

    // 4 seats at the table:
    // Seat 0: Bottom (Primary)
    // Seat 1: Left
    // Seat 2: Top
    // Seat 3: Right
    this.seats = [
      { id: 0, name: 'You', accessory: '🧢', isHuman: false, wsId: null, chips: DEFAULT_CHIPS, currentBet: 0, folded: false, allIn: false, holeCards: [], isReady: false },
      { id: 1, name: 'Bob', accessory: '🎩', isHuman: false, wsId: null, chips: DEFAULT_CHIPS, currentBet: 0, folded: false, allIn: false, holeCards: [], isReady: true },
      { id: 2, name: 'Alice', accessory: '👑', isHuman: false, wsId: null, chips: DEFAULT_CHIPS, currentBet: 0, folded: false, allIn: false, holeCards: [], isReady: true },
      { id: 3, name: 'Charlie', accessory: '🕶️', isHuman: false, wsId: null, chips: DEFAULT_CHIPS, currentBet: 0, folded: false, allIn: false, holeCards: [], isReady: true }
    ];

    this.deck = [];
    this.communityCards = [];
    this.burnedCards = [];
    this.forcedCardQueue = [];
    this.pot = 0;
    this.currentBet = 0;
    this.minRaise = BIG_BLIND;
    this.phase = 'IDLE'; // IDLE, PRE-FLOP, FLOP, TURN, RIVER, SHOWDOWN
    this.dealerIdx = 0;
    this.currentTurnIdx = 0;
    this.handCount = 0;
    this.peekAccess = new Set(); // seat indices that bought peek for current hand
    this.botTimer = null;
    this.nextHandTimer = null;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // WebSocket upgrade
    if ((request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const playerName = url.searchParams.get('name') || 'Player';
      const accessory = url.searchParams.get('accessory') || '🧢';
      const requestedSeat = url.searchParams.get('seat');

      server.accept();
      this.handleSession(server, { playerName, accessory, requestedSeat });

      return new Response(null, { status: 101, webSocket: client });
    }

    // HTTP room status endpoint
    if (url.pathname === '/status' || url.pathname.endsWith('/status')) {
      const activeHumans = this.seats.filter(s => s.isHuman).length;
      return new Response(JSON.stringify({
        room: url.searchParams.get('room') || 'default',
        phase: this.phase,
        pot: this.pot,
        activeHumans,
        seats: this.seats.map(s => ({ id: s.id, name: s.name, isHuman: s.isHuman, chips: s.chips, accessory: s.accessory }))
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response('Not found', { status: 404 });
  }

  handleSession(ws, { playerName, accessory, requestedSeat }) {
    const sessionId = 'session_' + Math.random().toString(36).substring(2, 9);

    // Assign to a seat:
    // Try requestedSeat if valid and empty, else take first unoccupied human seat or take over a bot seat
    let assignedSeat = null;
    if (requestedSeat !== null && requestedSeat !== undefined) {
      const sIdx = parseInt(requestedSeat, 10);
      if (sIdx >= 0 && sIdx < 4 && !this.seats[sIdx].isHuman) {
        assignedSeat = this.seats[sIdx];
      }
    }

    if (!assignedSeat) {
      // Find first non-human seat (prefer Seat 0 if available)
      assignedSeat = this.seats.find(s => s.id === 0 && !s.isHuman) ||
                     this.seats.find(s => !s.isHuman);
    }

    if (!assignedSeat) {
      // Table full of humans
      ws.send(JSON.stringify({ type: 'error', message: 'Table is full (4 human players already seated).' }));
      ws.close(1008, 'Table full');
      return;
    }

    // Configure seat
    assignedSeat.isHuman = true;
    assignedSeat.wsId = sessionId;
    assignedSeat.name = playerName.slice(0, 14);
    assignedSeat.accessory = accessory || '🧢';
    assignedSeat.isReady = true;

    const session = {
      ws,
      id: sessionId,
      seatIdx: assignedSeat.id,
      name: assignedSeat.name,
      accessory: assignedSeat.accessory
    };
    this.sessions.set(ws, session);

    // Send welcome packet
    ws.send(JSON.stringify({
      type: 'welcome',
      seatIdx: assignedSeat.id,
      sessionId: sessionId,
      name: assignedSeat.name,
      accessory: assignedSeat.accessory,
      chips: assignedSeat.chips
    }));

    // Broadcast updated state and notification
    this.broadcastState();
    this.broadcastLog(`👋 ${assignedSeat.name} joined seat ${assignedSeat.id}!`, 'system');

    // If game is IDLE, check if we can start
    if (this.phase === 'IDLE') {
      setTimeout(() => this.startNewHand(), 600);
    }

    // Setup WebSocket event handlers
    ws.addEventListener('message', async (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleClientMessage(ws, session, msg);
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    });

    ws.addEventListener('close', () => {
      this.handleDisconnect(ws, session);
    });

    ws.addEventListener('error', () => {
      this.handleDisconnect(ws, session);
    });
  }

  handleDisconnect(ws, session) {
    if (!this.sessions.has(ws)) return;
    this.sessions.delete(ws);

    const seat = this.seats[session.seatIdx];
    if (seat && seat.wsId === session.id) {
      this.broadcastLog(`🚪 ${seat.name} left seat ${seat.id}. Bot taking over.`, 'system');
      
      // Default bot fallback names and accessories
      const defaultBots = [
        { name: 'Player', accessory: '🧢' },
        { name: 'Bob', accessory: '🎩' },
        { name: 'Alice', accessory: '👑' },
        { name: 'Charlie', accessory: '🕶️' }
      ];
      const botDef = defaultBots[seat.id] || { name: 'Bot', accessory: '🤖' };

      seat.isHuman = false;
      seat.wsId = null;
      seat.name = botDef.name;
      seat.accessory = botDef.accessory;
      seat.isReady = true;

      // If it was this seat's turn, trigger bot turn
      if (this.phase !== 'IDLE' && this.phase !== 'SHOWDOWN' && this.currentTurnIdx === seat.id) {
        this.scheduleBotTurn();
      }

      this.broadcastState();
    }
  }

  handleClientMessage(ws, session, msg) {
    const seat = this.seats[session.seatIdx];
    if (!seat) return;

    switch (msg.action) {
      case 'start_hand':
      case 'ready':
        if (this.phase === 'IDLE' || this.phase === 'SHOWDOWN') {
          this.startNewHand();
        }
        break;

      case 'player_action':
        this.handlePlayerAction(session.seatIdx, msg.type, msg.amount);
        break;

      case 'bribe':
        this.handleBribe(session.seatIdx, msg.bribeType, msg.card);
        break;

      case 'chat':
        if (msg.text && typeof msg.text === 'string') {
          const clean = msg.text.trim().slice(0, 150);
          if (clean) {
            this.broadcastChat(seat.name, clean, 'chat-human');
          }
        }
        break;

      case 'join':
      case 'rename':
        if (msg.name && typeof msg.name === 'string') {
          seat.name = msg.name.trim().slice(0, 14);
        }
        if (msg.accessory) seat.accessory = msg.accessory;
        this.broadcastState();
        break;
    }
  }

  // Authoritative Texas Hold'em Game Engine

  createDeck() {
    const d = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        d.push({
          suit: suit.symbol,
          color: suit.color,
          rank: rank.rank,
          val: rank.val
        });
      }
    }
    // Fisher-Yates shuffle
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  drawCard() {
    if (this.forcedCardQueue.length > 0) {
      const forced = this.forcedCardQueue.shift();
      const idx = this.deck.findIndex(c => c.val === forced.val && c.suit === forced.suit);
      if (idx !== -1) {
        return this.deck.splice(idx, 1)[0];
      }
      return forced;
    }
    return this.deck.pop();
  }

  startNewHand() {
    clearTimeout(this.botTimer);
    clearTimeout(this.nextHandTimer);

    // Reset bankrupt players to $1000 for friendly play
    this.seats.forEach(s => {
      if (s.chips < BIG_BLIND) s.chips = DEFAULT_CHIPS;
      s.folded = false;
      s.allIn = false;
      s.currentBet = 0;
      s.holeCards = [];
    });

    this.handCount++;
    this.deck = this.createDeck();
    this.communityCards = [];
    this.burnedCards = [];
    this.forcedCardQueue = [];
    this.pot = 0;
    this.peekAccess.clear();

    // Rotate dealer button
    this.dealerIdx = (this.dealerIdx + 1) % 4;

    // Small blind & Big blind
    const sbIdx = (this.dealerIdx + 1) % 4;
    const bbIdx = (this.dealerIdx + 2) % 4;

    const sbPlayer = this.seats[sbIdx];
    const bbPlayer = this.seats[bbIdx];

    const sbAmt = Math.min(sbPlayer.chips, SMALL_BLIND);
    sbPlayer.chips -= sbAmt;
    sbPlayer.currentBet = sbAmt;
    if (sbPlayer.chips === 0) sbPlayer.allIn = true;

    const bbAmt = Math.min(bbPlayer.chips, BIG_BLIND);
    bbPlayer.chips -= bbAmt;
    bbPlayer.currentBet = bbAmt;
    if (bbPlayer.chips === 0) bbPlayer.allIn = true;

    this.pot = sbAmt + bbAmt;
    this.currentBet = BIG_BLIND;
    this.minRaise = BIG_BLIND * 2;

    // Deal 2 hole cards to each player
    for (let i = 0; i < 2; i++) {
      for (const s of this.seats) {
        s.holeCards.push(this.drawCard());
      }
    }

    this.phase = 'PRE-FLOP';
    // First to act pre-flop is UTG (dealer + 3 % 4)
    this.currentTurnIdx = (this.dealerIdx + 3) % 4;

    this.broadcastLog(`🃏 Hand #${this.handCount} started! Blinds: $${SMALL_BLIND}/$${BIG_BLIND}.`, 'system');
    this.broadcastState();

    if (!this.seats[this.currentTurnIdx].isHuman) {
      this.scheduleBotTurn();
    }
  }

  handlePlayerAction(seatIdx, action, raiseAmount = 0) {
    if (this.phase === 'IDLE' || this.phase === 'SHOWDOWN') return;
    if (seatIdx !== this.currentTurnIdx) return;

    const player = this.seats[seatIdx];
    if (!player || player.folded || player.allIn) return;

    const toCall = this.currentBet - player.currentBet;

    if (action === 'fold') {
      player.folded = true;
      this.broadcastLog(`❌ ${player.name} folds.`, 'action');
    } else if (action === 'check') {
      if (toCall > 0) {
        // Must call or fold if facing a bet
        return;
      }
      this.broadcastLog(`✓ ${player.name} checks.`, 'action');
    } else if (action === 'call') {
      const callAmt = Math.min(player.chips, toCall);
      player.chips -= callAmt;
      player.currentBet += callAmt;
      this.pot += callAmt;
      if (player.chips === 0) player.allIn = true;
      this.broadcastLog(`📞 ${player.name} calls $${callAmt}.`, 'action');
    } else if (action === 'raise') {
      const targetBet = Math.max(Number(raiseAmount) || 0, this.minRaise);
      const needed = targetBet - player.currentBet;
      const actualBet = Math.min(player.chips, needed);

      player.chips -= actualBet;
      player.currentBet += actualBet;
      this.pot += actualBet;

      if (player.currentBet > this.currentBet) {
        const raiseDiff = player.currentBet - this.currentBet;
        this.currentBet = player.currentBet;
        this.minRaise = this.currentBet + Math.max(raiseDiff, BIG_BLIND);
      }

      if (player.chips === 0) player.allIn = true;
      this.broadcastLog(`🚀 ${player.name} raises to $${player.currentBet}!`, 'action');
    }

    this.broadcastState();
    this.advanceTurn();
  }

  advanceTurn() {
    clearTimeout(this.botTimer);

    // 1. Check if only 1 player remains unfolded
    const activePlayers = this.seats.filter(s => !s.folded);
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      winner.chips += this.pot;
      this.broadcastLog(`🏆 ${winner.name} wins the pot of $${this.pot} (Everyone else folded)!`, 'winner');
      this.phase = 'SHOWDOWN';
      this.broadcastState(true);
      this.nextHandTimer = setTimeout(() => this.startNewHand(), 4500);
      return;
    }

    // 2. Check if betting round is complete
    const eligibleToAct = this.seats.filter(s => !s.folded && !s.allIn);
    const roundFinished = eligibleToAct.every(s => s.currentBet === this.currentBet);

    if (roundFinished) {
      this.advanceBettingRound();
      return;
    }

    // 3. Find next active player
    let nextIdx = (this.currentTurnIdx + 1) % 4;
    let loops = 0;
    while ((this.seats[nextIdx].folded || this.seats[nextIdx].allIn) && loops < 4) {
      nextIdx = (nextIdx + 1) % 4;
      loops++;
    }

    if (loops >= 4) {
      // Everyone is all-in or folded! Run out the remaining cards to showdown.
      this.advanceBettingRound();
      return;
    }

    this.currentTurnIdx = nextIdx;
    this.broadcastState();

    if (!this.seats[this.currentTurnIdx].isHuman) {
      this.scheduleBotTurn();
    }
  }

  advanceBettingRound() {
    // Reset round bets
    this.seats.forEach(s => { s.currentBet = 0; });
    this.currentBet = 0;
    this.minRaise = BIG_BLIND;

    // Burn 1 card
    if (this.deck.length > 0) {
      this.burnedCards.push(this.deck.pop());
    }

    if (this.phase === 'PRE-FLOP') {
      // Deal Flop (3 cards)
      this.communityCards.push(this.drawCard(), this.drawCard(), this.drawCard());
      this.phase = 'FLOP';
      this.broadcastLog(`🃏 Flop dealt: ${this.communityCards.map(c => c.rank + c.suit).join(' ')}`, 'system');
    } else if (this.phase === 'FLOP') {
      // Deal Turn (1 card)
      this.communityCards.push(this.drawCard());
      this.phase = 'TURN';
      this.broadcastLog(`🃏 Turn card: ${this.communityCards[3].rank}${this.communityCards[3].suit}`, 'system');
    } else if (this.phase === 'TURN') {
      // Deal River (1 card)
      this.communityCards.push(this.drawCard());
      this.phase = 'RIVER';
      this.broadcastLog(`🃏 River card: ${this.communityCards[4].rank}${this.communityCards[4].suit}`, 'system');
    } else if (this.phase === 'RIVER') {
      // Go to Showdown
      this.resolveShowdown();
      return;
    }

    // Check if remaining players are all all-in
    const playersCanBet = this.seats.filter(s => !s.folded && !s.allIn);
    if (playersCanBet.length <= 1) {
      // Fast run-out
      setTimeout(() => this.advanceBettingRound(), 1200);
      this.broadcastState();
      return;
    }

    // Next turn starts after dealer
    let nextIdx = (this.dealerIdx + 1) % 4;
    while (this.seats[nextIdx].folded || this.seats[nextIdx].allIn) {
      nextIdx = (nextIdx + 1) % 4;
    }

    this.currentTurnIdx = nextIdx;
    this.broadcastState();

    if (!this.seats[this.currentTurnIdx].isHuman) {
      this.scheduleBotTurn();
    }
  }

  resolveShowdown() {
    this.phase = 'SHOWDOWN';
    const contenders = this.seats.filter(s => !s.folded);

    // Evaluate all contenders' 7-card hands
    const evaluated = contenders.map(p => {
      const evalRes = HandEvaluator.evaluate7([...p.holeCards, ...this.communityCards]);
      return { player: p, eval: evalRes };
    });

    // Find best hand(s)
    let winners = [evaluated[0]];
    for (let i = 1; i < evaluated.length; i++) {
      const cmp = HandEvaluator.compare(evaluated[i].eval, winners[0].eval);
      if (cmp > 0) {
        winners = [evaluated[i]];
      } else if (cmp === 0) {
        winners.push(evaluated[i]);
      }
    }

    // Split pot if tie
    const splitAmount = Math.floor(this.pot / winners.length);
    const remainder = this.pot % winners.length;

    winners.forEach((w, idx) => {
      w.player.chips += splitAmount + (idx === 0 ? remainder : 0);
    });

    if (winners.length === 1) {
      const win = winners[0];
      this.broadcastLog(`🏆 ${win.player.name} wins $${this.pot} with a ${win.eval.name}!`, 'winner');
    } else {
      const names = winners.map(w => w.player.name).join(' & ');
      this.broadcastLog(`🤝 Split pot: ${names} tie with ${winners[0].eval.name}! ($${splitAmount} each)`, 'winner');
    }

    this.broadcastState(true); // Full reveal of all hands
    this.nextHandTimer = setTimeout(() => this.startNewHand(), 5500);
  }

  // Bribe System
  handleBribe(seatIdx, bribeType, cardPayload) {
    const player = this.seats[seatIdx];
    if (!player || player.chips <= 0) return;

    if (bribeType === 'peek') {
      const COST = BRIBE_COSTS.PEEK;
      if (player.chips < COST) {
        this.sendToSeat(seatIdx, { type: 'error', message: `Not enough chips! Peek costs $${COST}.` });
        return;
      }
      player.chips -= COST;
      this.peekAccess.add(seatIdx);

      // Send opponents' cards exclusively to the bribing player
      const opponentCards = this.seats
        .filter(s => s.id !== seatIdx && !s.folded && s.holeCards.length > 0)
        .map(s => ({ seatIdx: s.id, name: s.name, holeCards: s.holeCards }));

      this.sendToSeat(seatIdx, {
        type: 'bribe_success',
        bribeType: 'peek',
        opponentCards
      });
      this.broadcastLog(`🤫 Someone slipped the dealer $${COST} for X-Ray Vision!`, 'system');
      this.broadcastState();
    } else if (bribeType === 'specific_card') {
      const COST = BRIBE_COSTS.SPECIFIC_CARD;
      if (player.chips < COST) {
        this.sendToSeat(seatIdx, { type: 'error', message: `Not enough chips! Deal costs $${COST}.` });
        return;
      }
      if (!cardPayload || !cardPayload.rank || !cardPayload.suit) return;

      const targetCard = {
        rank: cardPayload.rank,
        val: RANKS.find(r => r.rank === cardPayload.rank)?.val || 14,
        suit: cardPayload.suit,
        color: ['♥', '♦'].includes(cardPayload.suit) ? 'red' : 'black'
      };

      player.chips -= COST;
      if (this.communityCards.length >= 5) {
        // Swap River card immediately
        this.burnedCards.push(this.communityCards[4]);
        this.communityCards[4] = targetCard;
        this.broadcastLog(`🤫 River card secretly replaced with ${targetCard.rank}${targetCard.suit}!`, 'winner');
      } else {
        this.forcedCardQueue = [targetCard];
        this.broadcastLog(`🤫 Next card placed on board locked to ${targetCard.rank}${targetCard.suit}!`, 'winner');
      }

      this.sendToSeat(seatIdx, { type: 'bribe_success', bribeType: 'specific_card', card: targetCard });
      this.broadcastState();
    } else if (bribeType === 'best_card') {
      const COST = BRIBE_COSTS.BEST_CARD;
      if (player.chips < COST) {
        this.sendToSeat(seatIdx, { type: 'error', message: `Not enough chips! Best card costs $${COST}.` });
        return;
      }
      if (player.holeCards.length < 2) return;

      // Calculate best next card for this player
      const bestCard = this.findBestNextCard(player);
      if (!bestCard) return;

      player.chips -= COST;
      if (this.communityCards.length >= 5) {
        this.burnedCards.push(this.communityCards[4]);
        this.communityCards[4] = bestCard.card;
        this.broadcastLog(`🤫 Guaranteed optimal River card dealt (${bestCard.card.rank}${bestCard.card.suit})!`, 'winner');
      } else {
        this.forcedCardQueue = [bestCard.card];
        this.broadcastLog(`🤫 Guaranteed optimal next card locked!`, 'winner');
      }

      this.sendToSeat(seatIdx, { type: 'bribe_success', bribeType: 'best_card', card: bestCard.card });
      this.broadcastState();
    }
  }

  findBestNextCard(player) {
    const usedKeys = new Set();
    this.seats.forEach(s => s.holeCards.forEach(c => usedKeys.add(`${c.val}_${c.suit}`)));
    this.communityCards.forEach(c => usedKeys.add(`${c.val}_${c.suit}`));
    this.burnedCards.forEach(c => usedKeys.add(`${c.val}_${c.suit}`));

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

    let bestOption = null;
    const baseBoard = this.communityCards.length >= 5 ? this.communityCards.slice(0, 4) : [...this.communityCards];

    for (const card of candidates) {
      const testCards = [...player.holeCards, ...baseBoard, card];
      const evaluation = HandEvaluator.evaluate7(testCards);
      if (!bestOption || HandEvaluator.compare(evaluation, bestOption.eval) > 0) {
        bestOption = { card, eval: evaluation };
      }
    }
    return bestOption;
  }

  // Bot Turn Automation
  scheduleBotTurn() {
    clearTimeout(this.botTimer);
    const botSeat = this.seats[this.currentTurnIdx];
    if (!botSeat || botSeat.isHuman || botSeat.folded || botSeat.allIn) return;

    const delay = 800 + Math.floor(Math.random() * 800);
    this.botTimer = setTimeout(() => {
      this.executeBotMove(botSeat);
    }, delay);
  }

  executeBotMove(bot) {
    if (this.phase === 'IDLE' || this.phase === 'SHOWDOWN') return;
    if (this.currentTurnIdx !== bot.id) return;

    const toCall = this.currentBet - bot.currentBet;
    const hasCards = bot.holeCards.length === 2;
    const boardCards = [...this.communityCards];

    let evalScore = 0;
    if (hasCards && boardCards.length >= 3) {
      const evalRes = HandEvaluator.evaluate7([...bot.holeCards, ...boardCards]);
      evalScore = evalRes.category;
    } else if (hasCards) {
      // Pre-flop strength
      const highVal = Math.max(bot.holeCards[0].val, bot.holeCards[1].val);
      const isPair = bot.holeCards[0].val === bot.holeCards[1].val;
      evalScore = isPair ? 2 : (highVal >= 11 ? 1 : 0);
    }

    if (toCall === 0) {
      // Can check for free
      if (evalScore >= 2 && Math.random() < 0.45 && bot.chips > BIG_BLIND) {
        // Raise
        this.handlePlayerAction(bot.id, 'raise', this.currentBet + BIG_BLIND * 2);
      } else {
        this.handlePlayerAction(bot.id, 'check');
      }
    } else {
      // Facing bet
      if (toCall <= BIG_BLIND || evalScore >= 1 || Math.random() < 0.35) {
        this.handlePlayerAction(bot.id, 'call');
      } else {
        this.handlePlayerAction(bot.id, 'fold');
      }
    }
  }

  // Network Broadcasting
  broadcastState(revealAll = false) {
    for (const [ws, session] of this.sessions) {
      const isPeeking = this.peekAccess.has(session.seatIdx);

      const sanitizedSeats = this.seats.map(s => {
        const isSelf = s.id === session.seatIdx;
        const shouldShowCards = revealAll || isSelf || isPeeking;

        return {
          id: s.id,
          name: s.name,
          accessory: s.accessory,
          isHuman: s.isHuman,
          chips: s.chips,
          currentBet: s.currentBet,
          folded: s.folded,
          allIn: s.allIn,
          holeCards: shouldShowCards ? s.holeCards : (s.holeCards.length > 0 ? [{ hidden: true }, { hidden: true }] : []),
          isPeeked: isPeeking && !isSelf && s.holeCards.length > 0
        };
      });

      const packet = {
        type: 'room_state',
        phase: this.phase,
        pot: this.pot,
        currentBet: this.currentBet,
        dealerIdx: this.dealerIdx,
        currentTurnIdx: this.currentTurnIdx,
        communityCards: this.communityCards,
        seats: sanitizedSeats,
        yourSeatIdx: session.seatIdx
      };

      try {
        ws.send(JSON.stringify(packet));
      } catch (e) {
        // connection closed
      }
    }
  }

  sendToSeat(seatIdx, payload) {
    for (const [ws, session] of this.sessions) {
      if (session.seatIdx === seatIdx) {
        try {
          ws.send(JSON.stringify(payload));
        } catch (e) {}
      }
    }
  }

  broadcastLog(text, logType = 'system') {
    const msg = JSON.stringify({ type: 'log', text, logType });
    for (const [ws] of this.sessions) {
      try { ws.send(msg); } catch (e) {}
    }
  }

  broadcastChat(sender, text, className = 'chat-human') {
    const msg = JSON.stringify({ type: 'chat', sender, text, className });
    for (const [ws] of this.sessions) {
      try { ws.send(msg); } catch (e) {}
    }
  }
}

// Default Cloudflare Worker entry point
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS Headers for API & WebSockets
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Upgrade'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Favicon handler
    if (url.pathname === '/favicon.ico') {
      const svgSpade = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">♠</text></svg>`;
      return new Response(svgSpade, {
        headers: { ...corsHeaders, 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }
      });
    }

    // Health / API status
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'fake-poker-backend', time: Date.now() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // WebSocket Room routing via Durable Objects
    if (url.pathname === '/ws' || url.pathname.startsWith('/ws/')) {
      if (!env.POKER_ROOM) {
        return new Response(JSON.stringify({ error: 'POKER_ROOM Durable Object binding is not configured in wrangler.toml' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const roomName = url.searchParams.get('room') || 'default';
      const id = env.POKER_ROOM.idFromName(roomName);
      const roomObject = env.POKER_ROOM.get(id);

      return roomObject.fetch(request);
    }

    // Room status HTTP lookup
    if (url.pathname === '/api/status') {
      if (!env.POKER_ROOM) {
        return new Response(JSON.stringify({ error: 'POKER_ROOM binding missing' }), { status: 500, headers: corsHeaders });
      }
      const roomName = url.searchParams.get('room') || 'default';
      const id = env.POKER_ROOM.idFromName(roomName);
      const roomObject = env.POKER_ROOM.get(id);
      return roomObject.fetch(request);
    }

    // Serve static frontend assets if configured (Workers Static Assets)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Fake Poker Cloudflare Workers Backend is Online. Connect via WebSocket to /ws?room=<room_name>', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }
};
