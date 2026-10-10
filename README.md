# Strategy Lab

A web app that builds an investment portfolio around **your** risk tolerance, shows the math behind it, and lets you stress-test it against real market history. Built for students and first-time investors who want to understand *why* a portfolio looks the way it does, not just be handed one.

> Educational tool only. Nothing here is investment advice, and it never connects to a brokerage.

## What it does

| Area | What you get |
|---|---|
| **Risk quiz** | 12 questions about time horizon and how you'd react to losses, turned into five sub-scores and one 0–100 risk score. |
| **Stock swipe picker** | Choose how many individual stocks you want, then swipe through a 20-stock deck. Every sector always keeps its ETF; your picks sit on top of it. |
| **Dashboard & Portfolio** | Target allocation, expected return, volatility, Sharpe ratio, 1-year VaR, estimated worst drawdown, projected-value cone, and an efficient-frontier chart. |
| **Model It** | Sliders for the risk factors that recompute the whole portfolio live. Every stat says which slider would move it up or down (computed, not hand-written). |
| **Historical backtest** | Replays your holdings over up to 5 years of real weekly prices and compares them with the S&P 500. |
| **Thesis Builder** | Turns the portfolio into a written investment thesis with risks, review triggers, and a full methodology note. |
| **Stock Research & News** | Live price, volume, 52-week range and real price history for any ticker, plus live headlines. |
| **Watchlist & Thesis Tracker** | Save tickers and theses (stored in the browser). |

## How the portfolio engine works (`lib/portfolio.ts`)

1. Quiz answers → five sub-scores (horizon, loss composure, risk capacity, experience, leverage comfort) → one blended risk score, using a "lesser of willingness and ability" rule softened by an average.
2. The risk score sets a **target volatility** (capped by time horizon).
3. A **tilt model** decides how the risky part of the portfolio is split across 10 sleeves (broad market, tech, healthcare, energy, defense, financials, international, small-cap, leveraged, speculative). Leveraged and speculative sleeves are gated on explicit comfort and experience.
4. A **constrained optimizer** bisects the mix between that risky basket and bonds/cash until the covariance-implied portfolio volatility hits the target, enforcing per-sleeve caps.
5. Correlations come from a **4-factor model** (equity, rates, commodity, crypto loadings), so they are internally consistent.
6. Expected returns come from **J.P. Morgan's 2026 Long-Term Capital Market Assumptions** where they exist. A leveraged ETF's return is *derived* with the daily-rebalancing decay formula, `E[R] = N·μ − (N−1)·financing − N(N−1)/2·σ²`, which is why 3x exposure does not mean 3x return.

Anything that is a modeling assumption rather than a sourced number is labeled as such in the app (see the Methodology section in the Thesis Builder).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 13 automated tests of the engine and backtest math
```

Click **"Try the demo"** on the login screen. Sign-in is simulated and data stays in your browser's localStorage. No API keys are needed: live data comes from Yahoo Finance's public endpoints.

## Tech

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Recharts · Node's built-in test runner (via `tsx`). Optional Supabase support for real accounts is in the code but not enabled.

## Known limitations

- P/E, market cap, beta and dividend yield are illustrative: there is no free, keyless live source for them. The Stock Research page labels what is live.
- The backtest ignores trading costs and taxes, and past performance does not predict the future.
- Expected returns and correlations are long-run assumptions, not forecasts.

## AI disclosure

Claude (Anthropic's AI assistant, used through Claude Code) was used extensively to write and review code in this repository.
