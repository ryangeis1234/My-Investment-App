/* ============================================================================
 * stocks.ts — individual-stock universe for the swipe picker
 * ----------------------------------------------------------------------------
 * Each stock is tagged to the sleeve (sector) it layers onto. The sector ETF
 * from VEHICLE_HOLDINGS always stays in the portfolio as the base holding;
 * `applyStockPicks` carves out half of that sleeve's weight and splits it
 * across whichever stocks the user picked for that sleeve, so a sector never
 * loses its ETF and individual names never crowd it out entirely.
 * ========================================================================== */

import { Allocation, AllocationHolding } from './quiz';
import { Sleeve } from './portfolio';

export interface StockCard {
  ticker: string;
  name: string;
  sleeve: Sleeve;
  blurb: string;
}

export const STOCK_UNIVERSE: StockCard[] = [
  { ticker: 'AAPL', name: 'Apple', sleeve: 'Growth/Tech', blurb: 'Consumer hardware ecosystem with deep recurring services revenue.' },
  { ticker: 'MSFT', name: 'Microsoft', sleeve: 'Growth/Tech', blurb: 'Enterprise cloud and software, now leaning hard into AI infrastructure.' },
  { ticker: 'NVDA', name: 'NVIDIA', sleeve: 'Growth/Tech', blurb: 'Dominant AI/data-center chipmaker — high growth, high volatility.' },
  { ticker: 'GOOGL', name: 'Alphabet', sleeve: 'Growth/Tech', blurb: 'Search and cloud cash machine with a large AI research bet.' },
  { ticker: 'AMZN', name: 'Amazon', sleeve: 'Growth/Tech', blurb: 'E-commerce plus AWS cloud margins — two businesses in one.' },
  { ticker: 'UNH', name: 'UnitedHealth', sleeve: 'Healthcare', blurb: 'Largest US health insurer, demand holds up in recessions.' },
  { ticker: 'LLY', name: 'Eli Lilly', sleeve: 'Healthcare', blurb: 'Pharma growth leader riding GLP-1 weight-loss drug demand.' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', sleeve: 'Healthcare', blurb: 'Diversified pharma and medtech, decades of dividend stability.' },
  { ticker: 'JPM', name: 'JPMorgan Chase', sleeve: 'Financials', blurb: 'Largest US bank by assets, a rate-cycle bellwether.' },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway', sleeve: 'Financials', blurb: "Buffett's diversified holding company — insurance, rails, equities." },
  { ticker: 'V', name: 'Visa', sleeve: 'Financials', blurb: 'Global payment-network toll booth with high margins.' },
  { ticker: 'XOM', name: 'Exxon Mobil', sleeve: 'Energy', blurb: 'Integrated oil major, low-cost production and buybacks.' },
  { ticker: 'CVX', name: 'Chevron', sleeve: 'Energy', blurb: 'Integrated energy major with a long dividend-growth streak.' },
  { ticker: 'LMT', name: 'Lockheed Martin', sleeve: 'Defense/Aerospace', blurb: 'Prime defense contractor, long government contract visibility.' },
  { ticker: 'RTX', name: 'RTX Corporation', sleeve: 'Defense/Aerospace', blurb: 'Aerospace and defense systems across commercial and military.' },
  { ticker: 'NOC', name: 'Northrop Grumman', sleeve: 'Defense/Aerospace', blurb: 'Defense and space systems, strong backlog visibility.' },
  { ticker: 'AMD', name: 'Advanced Micro Devices', sleeve: 'Small-Cap Satellite', blurb: "Nvidia's chief rival in AI/data-center chips — higher-beta bet." },
  { ticker: 'CRM', name: 'Salesforce', sleeve: 'Small-Cap Satellite', blurb: 'Enterprise CRM software leader pushing into AI agents.' },
  { ticker: 'COIN', name: 'Coinbase', sleeve: 'Speculative', blurb: 'Largest US crypto exchange — direct, volatile crypto-adjacent exposure.' },
  { ticker: 'MSTR', name: 'MicroStrategy (Strategy)', sleeve: 'Speculative', blurb: 'Software company turned leveraged bitcoin-holding vehicle.' },
];

/**
 * Carve individually-picked stocks into an already-computed allocation. Each
 * sleeve keeps its ETF (or bond/cash split) at half its target weight; the
 * other half splits evenly across whichever picked stocks belong to that
 * sleeve. Sleeves with no picks are left exactly as the engine built them.
 */
export function applyStockPicks(allocation: Allocation, selectedTickers: string[]): Allocation {
  if (!selectedTickers.length) return allocation;

  const bySleeve = new Map<Sleeve, StockCard[]>();
  selectedTickers.forEach((t) => {
    const card = STOCK_UNIVERSE.find((s) => s.ticker === t);
    if (!card) return;
    const list = bySleeve.get(card.sleeve) ?? [];
    list.push(card);
    bySleeve.set(card.sleeve, list);
  });
  if (bySleeve.size === 0) return allocation;

  const ETF_SHARE = 0.5;
  const holdings: AllocationHolding[] = [];
  allocation.categories.forEach((cat) => {
    const existing = allocation.holdings.filter((h) => h.category === cat.category);
    const picks = bySleeve.get(cat.category as Sleeve);
    if (!picks || !picks.length) { holdings.push(...existing); return; }

    existing.forEach((h) => holdings.push({ ...h, weight: h.weight * ETF_SHARE }));
    const each = (cat.weight * (1 - ETF_SHARE)) / picks.length;
    picks.forEach((card) => holdings.push({ ticker: card.ticker, category: cat.category, weight: each, note: card.blurb }));
  });

  return { ...allocation, holdings };
}
