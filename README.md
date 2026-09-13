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

## 🤫 Secret Cheat Codes

Enter commands in the Table Chat (`💬 Chat`) starting with `##`, `#`, or `/`:

- `##peek` / `##xray`: Toggle **X-Ray Vision** to reveal all opponents' hole cards face-up with real-time hand evaluation.
- `##peek on` / `##peek off`: Explicitly enable or disable card reveal mode.
- `##peek Bob` / `##peek Alice` / `##peek Charlie`: Inspect a specific opponent's cards in chat.
- `##deal AS` (or any card `##deal 10H`, `##deal KD`): Force the specified card as the next community card dealt.
- `##deal best`: Auto-picks the optimal winning card for your hand.
- `##clear`: Clear all cheats and resume fair play.
- `##help`: Display the in-game command cheat sheet.

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
