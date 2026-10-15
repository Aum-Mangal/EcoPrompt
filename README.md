# 🌿 EcoPrompt — AI Environmental Impact Tracker

EcoPrompt is a lightweight Chrome Extension (Manifest V3) that estimates and visualizes the real-world environmental cost of AI responses in real time across **ChatGPT**, **Claude**, and **Gemini**.

Every AI query requires computational power in hyperscale data centers, consuming electricity and water for cooling, and emitting greenhouse gases into the atmosphere. EcoPrompt brings transparency to this consumption directly inside your AI chat windows.

---

## ✨ Features

- **Live In-Chat Badges**: Injects a sleek, real-time badge into ChatGPT, Claude, and Gemini turns displaying:
  - 💧 **Water Footprint** (mL)
  - ⚡ **Energy Consumed** (mWh)
  - 🌿 **Carbon Emissions** (mg $\text{CO}_2$)
  - 🔢 **Token Count**
- **Dashboard Popup**:
  - Interactive 3D revolving Earth animation (fully offline, no external HTTP calls)
  - 24-Hour, 7-Day, and All-Time impact breakdown
  - Network distribution comparison across AI platforms
  - Calendar-aligned 7-day usage timeline chart
  - Smartphone battery charge equivalence benchmark
  - Clear history / data reset control
- **Zero External Dependencies at Runtime**: 100% self-contained assets for offline functionality, enhanced privacy, and strict CSP compliance.

---

## 🔬 Scientific Methodology & Sources

EcoPrompt calculates emissions using peer-reviewed research and industry grid emission factors:

1. **Energy Intensity**:
   - GPT-4 / ChatGPT: $\approx 0.003\text{ mWh/token}$ ($3 \times 10^{-6}\text{ Wh/token}$) *(Patterson et al. 2021, Luccioni et al. 2023)*
   - Claude 3.5 Sonnet / Opus: $\approx 0.0025\text{ mWh/token}$
   - Gemini 1.5 / 2.0: $\approx 0.0028\text{ mWh/token}$
2. **Water Cooling Intensity**:
   - $\approx 1.8\text{ mL per Wh}$ ($1.8\text{ L per kWh}$) for on-site cooling towers and power generation water consumption *(Li et al. 2023, "Making AI Less Thirsty")*.
3. **Carbon Intensity**:
   - US national grid average $\approx 0.386\text{ gCO}_2\text{ per Wh}$ ($386\text{ gCO}_2/\text{kWh}$).
4. **Smartphone Battery Baseline**:
   - Modern smartphone battery capacity $\approx 12.0\text{ Wh}$ ($\sim 3,300\text{–}4,000\text{ mAh}$ at $3.8\text{V}$).

---

## 🚀 Installation & Setup

### 1. Build the Popup Dashboard
Ensure you have [Node.js](https://nodejs.org/) installed, then run:

```bash
# Install dependencies and build the popup dashboard
npm install
npm run build
```

### 2. Load into Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select this project root folder (`ecoprompt`).

---

## 🛠️ Development

- **Run Dev Server for Popup UI**:
  ```bash
  npm run dev
  ```
- **Lint Codebase**:
  ```bash
  npm run lint
  ```
- **Build Production Assets**:
  ```bash
  npm run build
  ```

---

## 📁 Project Structure

```
ecoprompt/
├── background/
│   └── worker.js           # Service worker (handles storage, deduplication, and events)
├── content/
│   ├── chatgpt.js          # ChatGPT content script (streaming observer & badge injection)
│   ├── claude.js           # Claude.ai content script
│   └── gemini.js           # Google Gemini content script
├── popup-src/              # React 19 + Vite dashboard source code
│   ├── src/
│   │   ├── assets/         # Bundled offline textures and assets
│   │   ├── App.jsx         # Main glassmorphic popup dashboard
│   │   └── index.css       # Popup styling and 3D Earth keyframe animation
│   └── dist/               # Built static production bundle
├── utils/
│   └── calculator.js       # Shared emission estimation engine
├── manifest.json           # Chrome Extension Manifest V3 configuration
└── package.json            # Build scripts and project metadata
```
