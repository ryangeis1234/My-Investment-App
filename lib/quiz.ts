import {
  optimize, analyse, frontier, deriveScores, scoreFromSub, DOWNTREND_POLICY,
  type PortfolioStats, type SubScores, type FrontierPoint,
} from './portfolio';

export { deriveScores, scoreFromSub, DOWNTREND_POLICY } from './portfolio';
export type { PortfolioStats, SubScores, FrontierPoint } from './portfolio';

export type ScoreOption = { label: string; points: number };
export type PrefOption = { label: string; value: string };
export type QuizQuestion =
  | { id: string; type: 'score'; text: string; options: ScoreOption[] }
  | { id: string; type: 'single-pref'; text: string; options: PrefOption[] }
  | { id: string; type: 'multi-pref'; max: number; text: string; options: PrefOption[] };

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: 'horizon', type: 'score', text: 'When will you likely need this money?', options: [
    { label: 'Within 1 year', points: 0 }, { label: '1–3 years', points: 1 }, { label: '3–7 years', points: 2 },
    { label: '7–15 years', points: 3 }, { label: '15+ years', points: 4 }
  ]},
  { id: 'drawdown', type: 'score', text: 'Your whole portfolio drops 30% in a month. You:', options: [
    { label: 'Sell everything', points: 0 }, { label: 'Sell some to cut losses', points: 1 }, { label: 'Hold and wait', points: 2 },
    { label: 'Do nothing, stay the course', points: 3 }, { label: 'Buy more at the lower price', points: 4 }
  ]},
  { id: 'single_shock', type: 'score', text: "One individual holding drops 25% in a week on bad news. You:", options: [
    { label: 'Sell immediately to limit further loss', points: 0 }, { label: 'Sell part of the position', points: 1 },
    { label: 'Wait a few days before deciding', points: 2 }, { label: "Hold — the thesis hasn't changed", points: 3 },
    { label: 'Add to the position at the lower price', points: 4 }
  ]},
  { id: 'correlated_crash', type: 'score', text: 'A recession hits and most of your holdings fall together. You:', options: [
    { label: 'Move to cash', points: 0 }, { label: 'Reduce risk assets significantly', points: 1 }, { label: 'Rebalance back to target', points: 2 },
    { label: 'Stay fully invested', points: 3 }, { label: 'Increase equity exposure', points: 4 }
  ]},
  { id: 'experience', type: 'score', text: 'How would you describe your investing experience?', options: [
    { label: "None — I'm new to this", points: 0 }, { label: 'Some — I know the basics', points: 1 }, { label: 'Comfortable with stocks/ETFs', points: 2 },
    { label: 'Active trader', points: 3 }, { label: 'Very experienced, incl. leverage/options', points: 4 }
  ]},
  { id: 'goal', type: 'score', text: "What's your primary goal for this account?", options: [
    { label: 'Preserve capital', points: 0 }, { label: 'Steady income', points: 1 }, { label: 'Balanced growth', points: 2 },
    { label: 'Aggressive growth', points: 3 }, { label: 'Maximize growth, risk tolerant', points: 4 }
  ]},
  { id: 'concentration', type: 'score', text: 'How much of your total savings does this account represent?', options: [
    { label: 'Nearly all of it', points: 0 }, { label: 'The majority', points: 1 }, { label: 'About half', points: 2 },
    { label: 'A minority', points: 3 }, { label: 'A small slice — the rest is secure elsewhere', points: 4 }
  ]},
  { id: 'leverage', type: 'score', text: 'How comfortable are you with leveraged products (e.g. 2x/3x ETFs)?', options: [
    { label: 'Not comfortable at all', points: 0 }, { label: 'Slightly', points: 1 }, { label: 'Somewhat', points: 2 },
    { label: 'Comfortable', points: 3 }, { label: 'Very comfortable — I want amplified exposure', points: 4 }
  ]},
  { id: 'prolonged', type: 'score', text: 'Markets are flat-to-down for 2 straight years. You:', options: [
    { label: 'Panic and exit', points: 0 }, { label: 'Get anxious but hold', points: 1 }, { label: 'Stay neutral', points: 2 },
    { label: 'Stay confident in the plan', points: 3 }, { label: 'See it as a buying opportunity', points: 4 }
  ]},
  { id: 'vehicle', type: 'single-pref', text: 'What kinds of investments do you want in your portfolio?', options: [
    { label: 'ETFs only — low-cost, index-fund style', value: 'etf' },
    { label: 'Individual stocks where it makes sense', value: 'stocks' },
    { label: 'Mutual funds', value: 'mutual' },
    { label: 'A mix of ETFs and individual stocks', value: 'mix' }
  ]},
  { id: 'sectors', type: 'multi-pref', max: 2, text: 'Any sectors you want to overweight? (choose up to 2, optional)', options: [
    { label: 'Technology', value: 'Technology' }, { label: 'Energy', value: 'Energy' }, { label: 'Defense / Aerospace', value: 'Defense' },
    { label: 'Healthcare', value: 'Healthcare' }, { label: 'Financials', value: 'Financials' }, { label: 'No preference', value: 'none' }
  ]},
  { id: 'downtrend_style', type: 'single-pref', text: 'How do you want downtrends handled in this portfolio?', options: [
    { label: 'Buy-and-hold — ride out volatility', value: 'hold' },
    { label: 'Balanced — occasional rebalancing, no hard rules', value: 'balanced' },
    { label: 'Rule-based stop-losses on individual positions', value: 'stop_loss' },
    { label: 'Fast, tactical sell-off out of weakness', value: 'tactical' }
  ]}
];

export const DOWNTREND_STYLE_LABEL: Record<string, string> = { hold: 'Buy-and-hold', balanced: 'Balanced / occasional rebalancing', stop_loss: 'Rule-based stop-losses', tactical: 'Fast tactical sell-off' };
export const VEHICLE_LABEL: Record<string, string> = { etf: 'ETFs only', stocks: 'Individual stocks', mutual: 'Mutual funds', mix: 'Mix of ETFs & stocks' };
export const SECTOR_CATEGORY_MAP: Record<string, string> = { Technology: 'Growth/Tech', Energy: 'Energy', Defense: 'Defense/Aerospace', Healthcare: 'Healthcare', Financials: 'Financials' };

export function scoreToProfile(score: number) {
  if (score <= 25) return { bucket: 'Conservative', blurb: 'Capital preservation first, growth second.' };
  if (score <= 50) return { bucket: 'Moderate', blurb: 'Balanced growth with meaningful downside ballast.' };
  if (score <= 75) return { bucket: 'Growth-Oriented', blurb: 'Tilted toward equities and sector bets, some amplified exposure.' };
  return { bucket: 'Aggressive / High-Leverage', blurb: 'Maximum growth tilt, leveraged and speculative satellites included.' };
}


type HoldingSpec = { ticker: string; split: number; note?: string };
const VEHICLE_HOLDINGS: Record<string, Record<string, HoldingSpec[]>> = {
  etf: {
    'Bonds/Cash': [{ ticker: 'BND', split: 0.7 }, { ticker: 'Cash', split: 0.3 }],
    'Core Broad Market': [{ ticker: 'VOO', split: 1 }],
    'Defense/Aerospace': [{ ticker: 'ITA', split: 1 }],
    'Energy': [{ ticker: 'XLE', split: 1 }],
    'Growth/Tech': [{ ticker: 'QQQ', split: 1 }],
    'Healthcare': [{ ticker: 'XLV', split: 1 }],
    'Financials': [{ ticker: 'XLF', split: 1 }],
    'International': [{ ticker: 'VXUS', split: 1 }],
    'Small-Cap Satellite': [{ ticker: 'IWM', split: 1 }],
    'Leveraged Equity': [{ ticker: 'SPXL', split: 1 }],
    'Speculative': [{ ticker: 'FBTC', split: 1 }]
  },
  mutual: {
    'Bonds/Cash': [{ ticker: 'VBTLX', split: 0.7 }, { ticker: 'Cash', split: 0.3 }],
    'Core Broad Market': [{ ticker: 'VFIAX', split: 1 }],
    'Defense/Aerospace': [{ ticker: 'LMT', split: 1, note: 'no clean defense mutual fund — stock shown' }],
    'Energy': [{ ticker: 'XOM', split: 1, note: 'no clean energy mutual fund — stock shown' }],
    'Growth/Tech': [{ ticker: 'VIGAX', split: 1 }],
    'Healthcare': [{ ticker: 'VGHCX', split: 1 }],
    'Financials': [{ ticker: 'JPM', split: 1, note: 'no clean financials mutual fund — stock shown' }],
    'International': [{ ticker: 'VTIAX', split: 1 }],
    'Small-Cap Satellite': [{ ticker: 'VSMAX', split: 1 }],
    'Leveraged Equity': [{ ticker: 'SPXL', split: 1, note: 'daily-leveraged products are ETF-only' }],
    'Speculative': [{ ticker: 'FBTC', split: 1, note: 'spot-crypto exposure is ETF-only' }]
  },
  stocks: {
    'Bonds/Cash': [{ ticker: 'BND', split: 0.7, note: 'no single-stock bond proxy — ETF shown' }, { ticker: 'Cash', split: 0.3 }],
    'Core Broad Market': [{ ticker: 'VOO', split: 1, note: 'no single-stock market proxy — ETF shown' }],
    'Defense/Aerospace': [{ ticker: 'LMT', split: 0.5 }, { ticker: 'RTX', split: 0.5 }],
    'Energy': [{ ticker: 'XOM', split: 0.5 }, { ticker: 'CVX', split: 0.5 }],
    'Growth/Tech': [{ ticker: 'MSFT', split: 0.5 }, { ticker: 'NVDA', split: 0.5 }],
    'Healthcare': [{ ticker: 'UNH', split: 0.5 }, { ticker: 'LLY', split: 0.5 }],
    'Financials': [{ ticker: 'JPM', split: 0.5 }, { ticker: 'BRK.B', split: 0.5 }],
    'International': [{ ticker: 'VXUS', split: 1, note: 'no single-stock intl proxy — ETF shown' }],
    'Small-Cap Satellite': [{ ticker: 'IWM', split: 1, note: 'no single-stock small-cap proxy — ETF shown' }],
    'Leveraged Equity': [{ ticker: 'SPXL', split: 1 }],
    'Speculative': [{ ticker: 'COIN', split: 1 }]
  },
  mix: {
    'Bonds/Cash': [{ ticker: 'BND', split: 0.7 }, { ticker: 'Cash', split: 0.3 }],
    'Core Broad Market': [{ ticker: 'VOO', split: 1 }],
    'Defense/Aerospace': [{ ticker: 'LMT', split: 1 }],
    'Energy': [{ ticker: 'XOM', split: 1 }],
    'Growth/Tech': [{ ticker: 'MSFT', split: 0.5 }, { ticker: 'NVDA', split: 0.5 }],
    'Healthcare': [{ ticker: 'UNH', split: 1 }],
    'Financials': [{ ticker: 'JPM', split: 1 }],
    'International': [{ ticker: 'VXUS', split: 1 }],
    'Small-Cap Satellite': [{ ticker: 'IWM', split: 1 }],
    'Leveraged Equity': [{ ticker: 'SPXL', split: 1 }],
    'Speculative': [{ ticker: 'FBTC', split: 1 }]
  }
};

export const CATEGORY_NOTES: Record<string, string> = {
  'Bonds/Cash': 'Downside ballast — dampens drawdowns.',
  'Core Broad Market': 'Broad S&P 500 exposure — the stable base.',
  'Defense/Aerospace': 'Lower-beta, contract-backed names.',
  'Energy': 'Cash-generative, cyclical commodity exposure.',
  'Growth/Tech': 'Higher-beta compounders for growth tilt.',
  'Healthcare': 'Defensive growth — demand is less cyclical.',
  'Financials': 'Cyclical, rate-sensitive exposure.',
  'International': 'Non-US diversification.',
  'Small-Cap Satellite': 'Higher-volatility domestic small caps.',
  'Leveraged Equity': '3x daily S&P 500 — amplifies both gains and losses; decays in choppy markets.',
  'Speculative': 'Highest-risk satellite (crypto-adjacent) — sized small on purpose.'
};

export interface AllocationHolding { ticker: string; category: string; weight: number; note?: string }
export interface AllocationCategory { category: string; weight: number }
export interface Allocation {
  categories: AllocationCategory[];
  holdings: AllocationHolding[];
  estBeta: number;
  vehicle: string;
  sectors: string[];
  /* engine output */
  stats: PortfolioStats;
  subScores: SubScores;
  targetVol: number;
  achievedVol: number;
  frontier: FrontierPoint[];
  rebalancing: { cashFloor: number; band: number; rule: string };
}

/**
 * Build a target portfolio from a risk score.
 *  - `answers` (the raw 0-4 quiz answers) drive the sub-factor tilts; when
 *    omitted a neutral profile consistent with `score` is synthesised so old
 *    callers keep working.
 *  - `subOverride` (used by the Portfolio Modeler's sliders) bypasses both
 *    `score` and `answers` and drives the engine directly from explicit
 *    0-1 sub-scores; the risk score itself is recomputed from it.
 */
export function computeAllocation(
  score: number,
  vehicle?: string,
  sectorPrefs?: string[],
  answers?: Record<string, number>,
  downtrendStyle?: string | null,
  subOverride?: SubScores,
  /** the frontier recomputes ~11 full optimizer passes — skip it for callers (e.g. the live
   *  slider modeler) that don't render it, so dragging a slider stays snappy. */
  skipFrontier = false,
): Allocation {
  const veh = vehicle && VEHICLE_HOLDINGS[vehicle] ? vehicle : 'mix';
  const sectors = (sectorPrefs || []).filter(x => x !== 'none');

  const sub: SubScores = subOverride
    ? subOverride
    : answers && Object.keys(answers).length
    ? deriveScores(answers).sub
    : (() => {
        const s0 = Math.max(0, Math.min(100, score));
        return { horizon: s0 / 100, tolerance: s0 / 100, capacity: s0 / 100, experience: s0 / 100, leverageComfort: Math.max(0, (s0 - 55) / 45) };
      })();
  const s = subOverride ? scoreFromSub(subOverride) : Math.max(0, Math.min(100, score));

  const opt = optimize(s, sub, sectors, downtrendStyle ?? null);
  const stats = analyse(opt.weights);

  // Every sleeve's BASE holding is always its ETF (broad, guaranteed coverage), except for the
  // 'mutual' preference which has its own dedicated fund tickers. 'stocks'/'mix' preferences express
  // themselves through the swipe-picked individual stocks layered on top via applyStockPicks() —
  // not by swapping the base holding, which would otherwise collide with a later stock pick.
  const baseTable = veh === 'mutual' ? VEHICLE_HOLDINGS.mutual : VEHICLE_HOLDINGS.etf;
  const categories: AllocationCategory[] = opt.weights.map(w => ({ category: w.sleeve, weight: w.weight }));
  const holdings: AllocationHolding[] = [];
  categories.forEach(c => {
    (baseTable[c.category] || VEHICLE_HOLDINGS.etf[c.category] || []).forEach(h =>
      holdings.push({ ticker: h.ticker, category: c.category, weight: c.weight * h.split, note: h.note }));
  });

  return {
    categories, holdings,
    estBeta: parseFloat(stats.beta.toFixed(2)),
    vehicle: veh, sectors,
    stats, subScores: sub,
    targetVol: opt.targetVol, achievedVol: opt.achievedVol,
    frontier: skipFrontier ? [] : frontier(sub, sectors, downtrendStyle ?? null),
    rebalancing: DOWNTREND_POLICY[downtrendStyle ?? 'balanced'] ?? DOWNTREND_POLICY.balanced,
  };
}

export interface RiskProfile {
  score: number; bucket: string; blurb: string; answers: Record<string, number>;
  vehicle: string; sectors: string[]; downtrendStyle: string | null; allocation: Allocation; generated_at?: string;
  selectedStocks?: string[];
}
