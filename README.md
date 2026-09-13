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

---

---

## 🤫 Dealer Bribes & Under-the-Table Actions

Use the in-game **🤫 Bribes** buttons (in the top header, start bar, or betting bar) to open the interactive **Bribe the Dealer** dialog:

- **👁️ Buy Card Peek ($250)**: Slipped under the table to reveal all opponents' hole cards face-up with real-time hand rankings for the duration of the hand.
- **✨ Guarantee Best Next Card ($750)**: The dealer analyzes the board and forces the optimal card to maximize your winning hand.
- **🎯 Bribe for Specific Card ($500)**: Interactive card picker (select Rank `2–A` and Suit `♠ ♥ ♦ ♣`) to force any exact card as the next community card (or swap the River).

*(Commands in `💬 Chat` such as `##bribe`, `##peek`, `##deal AS`, and `##deal best` also trigger these bribes and deduct chips accordingly).*

---

## How to Host on GitHub Pages (Free)

1. Push your local files to GitHub:
   ```bash
   cd /Users/yorangong/fake-poker
   git add .
   git commit -m "Add static Texas Hold'em web app"
   git push -u origin main
   ```
2. Open your repository on GitHub: **[https://github.com/yrgong/fake-poker](https://github.com/yrgong/fake-poker)**
3. Go to **Settings** (tab on the top right).
4. In the left sidebar, click **Pages**.
5. Under **Build and deployment** > **Branch**:
   - Select **`main`** branch.
   - Select folder **`/ (root)`**.
   - Click **Save**.
6. Wait 1–2 minutes, and your site will be live at:
   `https://yrgong.github.io/fake-poker/`

---

## Running Locally

Simply open `index.html` directly in any web browser:
```bash
open /Users/yorangong/fake-poker/index.html
```
Or start a local test server:
```bash
cd /Users/yorangong/fake-poker
python3 -m http.server 8000
```
Then visit `http://localhost:8000`.
