/* ============================================================================
 * thesis.ts — deterministic investment-thesis generator
 * ----------------------------------------------------------------------------
 * Turns a RiskProfile (score + sub-scores + optimiser output) into a written,
 * numbers-backed investment thesis: objective, strategic rationale per sleeve,
 * key risks, monitoring / invalidation triggers, and a rebalancing policy.
 * No external API — every sentence is derived from the computed portfolio.
 * ========================================================================== */

import { RiskProfile, CATEGORY_NOTES, VEHICLE_LABEL, DOWNTREND_STYLE_LABEL } from './quiz';
import { CMA_TABLE, CMA_SOURCES } from './portfolio';

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const pp = (x: number, d = 1) => `${x.toFixed(d)}%`;

export interface SleeveRationale { sleeve: string; weight: number; rationale: string }
export interface GeneratedThesis {
  headline: string;
  horizon: string;
  objective: string;
  summary: string;
  positioning: SleeveRationale[];
  catalysts: string[];
  keyRisks: string[];
  strengthening: string;
  weakening: string;
  invalidating: string;
  rebalancing: string;
  methodology: string;
  generatedAt: string;
}

const HORIZON_TEXT: Record<number, string> = {
  0: 'under 1 year', 1: '1–3 years', 2: '3–7 years', 3: '7–15 years', 4: '15+ years',
};

function horizonPhrase(profile: RiskProfile): string {
  return HORIZON_TEXT[profile.answers.horizon ?? 2] ?? '3–7 years';
}

function sleeveRationale(profile: RiskProfile, sleeve: string, weight: number): string {
  const { subScores: sub } = profile.allocation;
  const base = CATEGORY_NOTES[sleeve] ?? '';
  switch (sleeve) {
    case 'Bonds/Cash':
      return `${base} At ${pp(weight)} this sleeve is the volatility governor — it is sized to pull realised portfolio risk down to the ${pct(profile.allocation.targetVol)} target given a ${Math.round(sub.tolerance * 100)}/100 composure score.`;
    case 'Core Broad Market':
      return `${base} It anchors the equity book so single-sleeve bets never drive the outcome.`;
    case 'Growth/Tech':
      return `${base} Weight scales with the growth appetite in your answers (horizon ${Math.round(sub.horizon * 100)}/100, tolerance ${Math.round(sub.tolerance * 100)}/100); it is the primary return engine and the main source of tracking error vs. a plain index.`;
    case 'Leveraged Equity': {
      const lev = CMA_TABLE['Leveraged Equity'], core = CMA_TABLE['Core Broad Market'];
      return `${base} Included only because you rated leverage comfort ${Math.round(sub.leverageComfort * 100)}/100. The daily-rebalancing decay math is unforgiving: 3x the index's ${pct(core.mu)} expected return sounds like ${pct(core.mu * 3)}, but volatility drag and financing cost bring the modeled expected return down to just ${pct(lev.mu)} — barely above cash — while volatility triples to ${pct(lev.sigma)}. Held small and rebalanced tightly on purpose.`;
    }
    case 'Speculative':
      return `${base} Gated on both appetite and experience and capped hard; treat it as a call option, not a core holding.`;
    case 'International':
      return `${base} Reduces home-country concentration and adds a currency-diversification benefit.`;
    case 'Small-Cap Satellite':
      return `${base} A higher-beta domestic tilt; it lifts expected return but widens the drawdown.`;
    case 'Defense/Aerospace':
      return `${base} Contract-backed revenue makes this a lower-beta ballast inside the equity book${profile.sectors.includes('Defense') ? ' — additionally overweighted at your request.' : '.'}`;
    case 'Energy':
      return `${base} A real-asset / inflation hedge with low correlation to the tech book${profile.sectors.includes('Energy') ? ' — additionally overweighted at your request.' : '.'}`;
    case 'Healthcare':
      return `${base} Defensive growth; weight rises as composure falls to soften recession drawdowns${profile.sectors.includes('Healthcare') ? ' — additionally overweighted at your request.' : '.'}`;
    case 'Financials':
      return `${base} Rate-sensitive cyclical exposure${profile.sectors.includes('Financials') ? ' — additionally overweighted at your request.' : '.'}`;
    default:
      return base;
  }
}

export function generateThesis(profile: RiskProfile): GeneratedThesis {
  const a = profile.allocation;
  const st = a.stats;
  const horizon = horizonPhrase(profile);
  const retLow = st.expReturn - st.volatility;
  const retHigh = st.expReturn + st.volatility;

  const sorted = [...a.categories].sort((x, y) => y.weight - x.weight);
  const top3 = sorted.slice(0, 3).map((c) => `${c.category} (${pp(c.weight)})`).join(', ');

  const headline = `${profile.bucket} target portfolio — ${pct(a.targetVol)} volatility, ${pct(st.expReturn)} expected return`;

  const objective =
    `Compound capital over a ${horizon} horizon at a controlled risk level. The portfolio targets ` +
    `${pct(a.targetVol)} annualised volatility (realised estimate ${pct(a.achievedVol)}), consistent with a ` +
    `risk score of ${profile.score}/100 (${profile.bucket}). Vehicle preference: ${VEHICLE_LABEL[profile.vehicle] || 'Mix'}.`;

  const summary =
    `This allocation is generated by risk-targeting: your quiz answers map to a ${pct(a.targetVol)} volatility budget, ` +
    `and the engine blends a diversified risky sleeve against Bonds/Cash until the covariance-implied portfolio volatility ` +
    `hits that budget, subject to per-sleeve caps. The result carries an expected return of ${pct(st.expReturn)} ` +
    `(roughly ${pct(retLow)} to ${pct(retHigh)} in a typical year), a Sharpe ratio of ${st.sharpe.toFixed(2)}, ` +
    `a portfolio beta of ${st.beta.toFixed(2)} vs. the broad market, and an income yield of ${pct(st.yield)}. ` +
    `Largest positions: ${top3}. In a severe market cycle a peak-to-trough drawdown near ${pct(st.severeDrawdown)} is plausible; ` +
    `a 1-in-20 down year is around −${pct(st.var95)}. ` +
    (st.leverageExposure > 0
      ? `Leveraged/speculative sleeves total ${pct(st.leverageExposure)} of the book and are the first thing to trim if conviction drops.`
      : `No leveraged or speculative exposure is used at this risk level.`);

  const positioning: SleeveRationale[] = sorted.map((c) => ({
    sleeve: c.category, weight: c.weight, rationale: sleeveRationale(profile, c.category, c.weight),
  }));

  const catalysts = [
    `Regular contributions compounding at the ${pct(st.expReturn)} expected rate`,
    'Annual (or band-triggered) rebalancing harvesting mean-reversion between sleeves',
    a.categories.some((c) => c.category === 'Growth/Tech')
      ? 'Earnings growth in the Growth/Tech sleeve re-rating the equity book'
      : 'Broad-market earnings growth lifting the core sleeve',
    st.yield > 0.02 ? `Dividend/coupon income of ~${pct(st.yield)} reinvested` : 'Falling rates lifting duration-sensitive holdings',
  ];

  const keyRisks = [
    `Sequence risk: a large drawdown early in the ${horizon} horizon is hard to recover from — the ${pp(a.categories.find((c) => c.category === 'Bonds/Cash')?.weight ?? 0)} Bonds/Cash sleeve is the main mitigant.`,
    `Correlation risk: in a systemic sell-off the equity sleeves move together, so realised drawdown can exceed the ${pct(st.severeDrawdown)} estimate.`,
    `Model risk: expected returns and correlations are long-run assumptions, not forecasts; short-run outcomes vary widely.`,
    st.leverageExposure > 0
      ? `Volatility decay: the Leveraged Equity sleeve can underperform its 3x target badly in sideways markets even if the index ends flat.`
      : `Inflation risk: a low-volatility portfolio can still lose purchasing power if real returns compress.`,
    profile.sectors.length > 0
      ? `Concentration risk: the requested overweight to ${profile.sectors.join(', ')} adds idiosyncratic sector risk.`
      : `Home-country risk: US exposure dominates; a prolonged US underperformance would hurt.`,
  ];

  const dvBand = pp(a.rebalancing.band * 100, 0);
  const strengthening =
    `Realised volatility stays at or below ${pct(a.targetVol)}, the equity sleeves deliver returns in line with assumptions, ` +
    `and rebalancing is adding value. Rising contribution capacity or a longer horizon would justify stepping risk up a tier.`;
  const weakening =
    `Realised 12-month volatility runs materially above ${pct(a.targetVol * 1.3)}, drawdown approaches ${pct(st.severeDrawdown * 0.6)}, ` +
    `or the Sharpe ratio on trailing data falls below ${(st.sharpe * 0.5).toFixed(2)}. Response: rebalance to target and reassess the risk score.`;
  const invalidating =
    `A change in circumstances (the money is now needed within 1–2 years, income shock, or a step-change in risk capacity), ` +
    `or drawdown exceeding ${pct(Math.min(0.9, st.severeDrawdown * 1.15))}. Response: retake the risk quiz and regenerate the portfolio from the new score.`;

  const rebalancing =
    `${DOWNTREND_STYLE_LABEL[profile.downtrendStyle ?? 'balanced'] || 'Balanced'} policy. ${a.rebalancing.rule} ` +
    `Rebalance when any sleeve drifts more than ±${dvBand} (relative) from target. ` +
    `Cash floor: ${pct(a.rebalancing.cashFloor)}.`;

  const methodology =
    `Expected returns for ${CMA_SOURCES.sourced.join(', ')} are taken directly from ${CMA_SOURCES.citation} ` +
    `${CMA_SOURCES.modeled.join(', ')} have no published sector-level equivalent and are modeled as a spread off Core Broad Market using standard long-run risk-premium relationships. ` +
    `${CMA_SOURCES.derived.join(', ')} is not assumed at all — it is derived from the Core Broad Market assumption via the standard daily-rebalanced leveraged-ETF decay formula (E[R] = N·μ − (N−1)·financing − N(N−1)/2·σ², which is why 3x notional exposure does not mean 3x expected return). ` +
    `${CMA_SOURCES.placeholder.join(', ')} has no institutional capital-market assumption to anchor to and is left as an explicit high-uncertainty placeholder. Volatility figures use long-run ranges that are stable across major CMA providers. None of this is a forecast.`;

  return {
    headline, horizon, objective, summary, positioning, catalysts, keyRisks,
    strengthening, weakening, invalidating, rebalancing, methodology,
    generatedAt: new Date().toISOString(),
  };
}

/** map a generated thesis into the Thesis-tracker record shape */
export function thesisToRecord(profile: RiskProfile, g: GeneratedThesis) {
  const review = new Date();
  review.setMonth(review.getMonth() + 6);
  return {
    ticker: 'PORTFOLIO',
    title: g.headline,
    original_thesis: `${g.objective}\n\n${g.summary}`,
    entry_price: 0,
    expected_holding_period: g.horizon,
    expected_catalysts: g.catalysts.join('; '),
    primary_risks: g.keyRisks.join(' | '),
    strengthening_conditions: g.strengthening,
    weakening_conditions: g.weakening,
    invalidating_conditions: g.invalidating,
    target_review_date: review.toISOString().slice(0, 10),
    status: 'Active' as const,
  };
}
