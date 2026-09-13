# ♠ Fake Poker

A sleek, responsive, zero-dependency Texas Hold'em poker web application built with vanilla HTML5, CSS3, and modern JavaScript. Designed to run seamlessly directly in the browser or hosted for free on **GitHub Pages**.

## Live Demo on GitHub Pages
Once enabled, your game will be live at:
**`https://yrgong.github.io/fake-poker/`**

---

## Features

- **Standard Texas Hold'em Rules**: Full flow including Dealer Button, Small Blind ($10), Big Blind ($20), Pre-Flop, Flop, Turn, River, and Showdown.
- **Accurate 7-Card Hand Evaluator**: Ranks hands from High Card up to Royal Flush and resolves tie-breakers.
- **Interactive Bot Opponents**: Play against 3 AI opponents (Bob, Alice, and Charlie) with hand evaluation and situational betting/bluffing logic.
- **Live Hand Indicator**: Tells you your current best 5-card combination as community cards are revealed.
- **Web Audio Sound Effects**: Dynamic sound effects synthesized with the browser's native Web Audio API (no heavy external assets).
- **Responsive Table Design**: Casino felt styling that adapts to desktops, laptops, tablets, and mobile screens.
- **Secret Table Cheats & X-Ray Vision**: Built-in chat cheat engine to rig deals or peek at opponents' cards.
- **🌐 Cloudflare Workers Multiplayer**: Real-time multiplayer powered by Cloudflare Workers, Durable Objects, and WebSockets. Play with friends across multiple rooms while unoccupied seats are filled by bots.

---

## 🌐 Online Multiplayer (Cloudflare Workers Backend)

Fake Poker includes a high-performance, authoritative multiplayer backend built on **Cloudflare Workers** and **Durable Objects**.

### Multiplayer Capabilities:
- **Authoritative State Machine**: Server manages shuffling, betting rounds, pot splits, dealer bribes, and timers so no client can spoof cards.
- **Private Hole Cards**: Each player's hole cards are transmitted securely over WebSockets only to their respective client.
- **Dynamic Rooms**: Create or join any room code (e.g. `?room=table-777`). Durable Objects isolate table state per room with zero database overhead.
- **Seamless Human + Bot Integration**: 4 seats per table. When humans join, they claim seats; any open seats are automatically controlled by autonomous bots.
- **Shareable Invite Links**: Click **🌐 Online** > **📋 Share** to copy an instant room link to invite friends.
- **Offline Fallback**: Disconnecting or playing without the backend immediately falls back to 100% offline single-player against local bots.

### Deploying the Cloudflare Worker Backend:
1. Ensure you have [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed:
   ```bash
   npm install -g wrangler
   ```
2. Log in to your Cloudflare account:
   ```bash
   wrangler login
   ```
3. Test locally with Wrangler dev:
   ```bash
   wrangler dev
   ```
   *(Runs on `ws://localhost:8787/ws`)*
4. Deploy to Cloudflare:
   ```bash
   wrangler deploy
   ```
5. Enter your deployed Worker WebSocket URL in the game's **🌐 Online** dialog (e.g., `wss://fake-poker-backend.<subdomain>.workers.dev/ws`). Your room preferences and endpoint are saved automatically in your browser.

---

## 🤫 Dealer Bribes & Under-the-Table Actions

Use the in-game **🤫 Bribes** buttons (in the top header, start bar, or betting bar) to open the interactive **Bribe the Dealer** dialog:

- **👁️ Buy Card Peek ($250)**: Slipped under the table to reveal all opponents' hole cards face-up with real-time hand rankings for the duration of the hand.
- **✨ Guarantee Best Next Card ($750)**: The dealer analyzes the board and forces the optimal card to maximize your winning hand.
- **🎯 Bribe for Specific Card ($500)**: Interactive card picker (select Rank `2–A` and Suit `♠ ♥ ♦ ♣`) to force any exact card as the next community card (or swap the River).

*(Commands in `💬 Chat` such as `##bribe`, `##peek`, `##deal AS`, and `##deal best` also trigger these bribes and deduct chips accordingly in both offline and online modes).*

---

## How to Host Frontend on GitHub Pages (Free)

1. Push your local files to GitHub:
   ```bash
   git add .
   git commit -m "Add Cloudflare multiplayer backend and client"
   git push origin main
   ```
2. Open your repository on GitHub.
3. Go to **Settings** > **Pages**.
4. Under **Build and deployment** > **Branch**:
   - Select **`main`** branch and folder **`/ (root)`**.
   - Click **Save**.
5. Your frontend is live at:
   `https://<username>.github.io/fake-poker/`

---

## Running Locally

Simply open `index.html` directly in any web browser:
```bash
open index.html
```
Or start a local test server:
```bash
python3 -m http.server 8000
```
Then visit `http://localhost:8000`.
