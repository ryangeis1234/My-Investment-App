/* ============================================================================
 * portfolio.ts — risk-targeted strategic asset-allocation engine
 * ----------------------------------------------------------------------------
 * Pipeline:
 *   1. quiz answers -> risk-tolerance & risk-capacity sub-scores -> risk score
 *   2. risk score   -> target annualised portfolio volatility (glide path)
 *   3. tilt model   -> risky sub-portfolio weights (function of the sub-scores)
 *   4. optimiser    -> blend risky sleeve vs. bonds/cash by bisection so that
 *                      the covariance-implied portfolio vol hits the target,
 *                      then apply per-sleeve caps and re-solve (a few passes)
 *   5. analytics    -> expected return, vol, Sharpe, 1-yr 95% VaR, an estimated
 *                      severe drawdown, yield, and a small efficient frontier
 * The covariance matrix is generated from a 4-factor model
 * (equity / rates / commodity / crypto loadings) so correlations are internally
 * consistent rather than hand-typed.
 *
 * CAPITAL MARKET ASSUMPTIONS — sourcing (see CMA_SOURCES below for the
 * per-sleeve breakdown surfaced in the UI):
 *   Core Broad Market, International and Bonds/Cash returns are taken
 *   directly from J.P. Morgan Asset Management's 2026 Long-Term Capital
 *   Market Assumptions (10-15yr USD nominal, published Oct 2025):
 *   US large cap 6.7%, global equities 7.0%, US intermediate Treasuries 4.0%,
 *   US investment-grade credit 5.2%. Sector/style sleeves (Growth/Tech,
 *   Healthcare, Financials, Defense/Aerospace, Small-Cap Satellite, Energy)
 *   are NOT published by LTCMA-style reports at that granularity — they are
 *   modeled as a spread off Core Broad Market using standard long-run
 *   sector risk-premium relationships. Leveraged Equity is DERIVED, not
 *   assumed: it applies the standard daily-rebalanced leveraged-ETF decay
 *   formula to the Core Broad Market assumption (see `leveragedEtfCMA`).
 *   Speculative (crypto-adjacent) has no institutional CMA to anchor to and
 *   is left as an explicitly-labeled placeholder reflecting extreme
 *   uncertainty. Volatility figures use stylized long-run ranges that are
 *   stable across major CMA providers (JPMorgan / BlackRock / Vanguard).
 * ========================================================================== */

export type Sleeve =
  | 'Bonds/Cash'
  | 'Core Broad Market'
  | 'Defense/Aerospace'
  | 'Energy'
  | 'Growth/Tech'
  | 'Healthcare'
  | 'Financials'
  | 'International'
  | 'Small-Cap Satellite'
  | 'Leveraged Equity'
  | 'Speculative';

export const SLEEVES: Sleeve[] = [
  'Bonds/Cash', 'Core Broad Market', 'Defense/Aerospace', 'Energy', 'Growth/Tech',
  'Healthcare', 'Financials', 'International', 'Small-Cap Satellite', 'Leveraged Equity', 'Speculative',
];

/* --- Capital market assumptions (annualised, nominal) ---------------------- */
interface CMA { mu: number; sigma: number; yield: number; loadings: [number, number, number, number] }
//                                              [ equity, rates, commodity, crypto ]

/** long-run cash/T-bill proxy — the financing rate used for leverage drag and the Sharpe risk-free rate */
const CASH_RATE = 0.036;

/**
 * Expected return for a daily-rebalanced Nx leveraged product, derived (not assumed) from the
 * underlying's own CMA: geometric drag from daily rebalancing costs ~N(N-1)/2 * sigma^2 per year,
 * and the leveraged notional above 1x is borrowed at the financing rate.
 *   E[R_Nx] = N * mu_underlying - (N-1) * financingRate - N(N-1)/2 * sigma_underlying^2
 */
function leveragedEtfCMA(underlying: CMA, n: number, financingRate: number): CMA {
  const mu = n * underlying.mu - (n - 1) * financingRate - (n * (n - 1) / 2) * underlying.sigma * underlying.sigma;
  return { mu, sigma: n * underlying.sigma, yield: 0, loadings: [...underlying.loadings] as CMA['loadings'] };
}

const CORE: CMA = { mu: 0.067, sigma: 0.155, yield: 0.014, loadings: [1.00, 0.15, 0.05, 0.00] };

export const CMA_TABLE: Record<Sleeve, CMA> = {
  // directly sourced: JPMorgan 2026 LTCMA, 10-15yr USD nominal (intermediate Treasury 4.0% / IG credit 5.2% blend, 70/30 with cash)
  'Bonds/Cash':          { mu: 0.039, sigma: 0.055, yield: 0.039, loadings: [0.00,  1.00, 0.00, 0.00] },
  // directly sourced: JPMorgan 2026 LTCMA "US large cap" 6.7%
  'Core Broad Market':   CORE,
  // directly sourced: JPMorgan 2026 LTCMA "global equities (USD)" 7.0%
  'International':       { mu: 0.070, sigma: 0.170, yield: 0.030, loadings: [0.85,  0.05, 0.15, 0.00] },
  // modeled: Core + historical sector risk-premium spread (not separately published by LTCMA-style reports)
  'Defense/Aerospace':   { mu: CORE.mu + 0.005, sigma: 0.180, yield: 0.018, loadings: [0.75,  0.10, 0.05, 0.00] },
  // modeled: 50/50 blend of Core equity beta and JPMorgan LTCMA "broad commodities" (4.6%)
  'Energy':              { mu: 0.5 * CORE.mu + 0.5 * 0.046, sigma: 0.240, yield: 0.035, loadings: [0.55,  0.00, 0.80, 0.00] },
  // modeled: Core + growth/quality premium spread
  'Growth/Tech':         { mu: CORE.mu + 0.020, sigma: 0.225, yield: 0.006, loadings: [1.05, -0.10, 0.00, 0.15] },
  // modeled: Core - defensive/lower-beta spread
  'Healthcare':          { mu: CORE.mu - 0.003, sigma: 0.150, yield: 0.016, loadings: [0.70,  0.05, 0.00, 0.00] },
  // modeled: Core + cyclical/rate-sensitive spread
  'Financials':          { mu: CORE.mu + 0.003, sigma: 0.190, yield: 0.022, loadings: [0.95,  0.35, 0.00, 0.00] },
  // modeled: Core + small-cap size premium spread
  'Small-Cap Satellite': { mu: CORE.mu + 0.010, sigma: 0.205, yield: 0.013, loadings: [1.05,  0.00, 0.10, 0.05] },
  // derived from Core via the leveraged-ETF decay formula above — not a standalone assumption
  'Leveraged Equity':    leveragedEtfCMA(CORE, 3, CASH_RATE),
  // no institutional CMA exists for this exposure — explicit placeholder reflecting extreme uncertainty
  'Speculative':         { mu: 0.140, sigma: 0.650, yield: 0.000, loadings: [0.35, -0.05, 0.05, 1.00] },
};

/** what each CMA figure is grounded in, surfaced in the UI's methodology note */
export const CMA_SOURCES: { sourced: string[]; modeled: string[]; derived: string[]; placeholder: string[]; citation: string } = {
  sourced: ['Bonds/Cash', 'Core Broad Market', 'International'],
  modeled: ['Defense/Aerospace', 'Energy', 'Growth/Tech', 'Healthcare', 'Financials', 'Small-Cap Satellite'],
  derived: ['Leveraged Equity'],
  placeholder: ['Speculative'],
  citation: "J.P. Morgan Asset Management, 2026 Long-Term Capital Market Assumptions (10-15yr, USD nominal), published Oct 2025.",
};

const RISK_FREE = CASH_RATE;

/* --- linear algebra helpers --------------------------------------------- */
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

/** factor-model correlation between two sleeves (cosine of loading vectors) */
export function sleeveCorr(a: Sleeve, b: Sleeve): number {
  if (a === b) return 1;
  const la = CMA_TABLE[a].loadings, lb = CMA_TABLE[b].loadings;
  const denom = norm(la) * norm(lb) || 1;
  return clamp(dot(la, lb) / denom, -0.6, 0.98);
}

/** covariance matrix Σ for an ordered list of sleeves */
export function covMatrix(order: Sleeve[]): number[][] {
  return order.map((si) =>
    order.map((sj) => sleeveCorr(si, sj) * CMA_TABLE[si].sigma * CMA_TABLE[sj].sigma),
  );
}

/** annualised portfolio volatility from weights (fractions) + covariance */
export function portfolioVol(weights: number[], cov: number[][]): number {
  let v = 0;
  for (let i = 0; i < weights.length; i++)
    for (let j = 0; j < weights.length; j++) v += weights[i] * weights[j] * cov[i][j];
  return Math.sqrt(Math.max(v, 0));
}

/* --- quiz scoring ------------------------------------------------------- */
export interface SubScores {
  horizon: number;      // 0-1  time available
  tolerance: number;    // 0-1  behavioural composure under stress
  capacity: number;     // 0-1  ability to take risk (concentration + goal)
  experience: number;   // 0-1
  leverageComfort: number; // 0-1
}

/** blend the five sub-scores into a single 0-100 risk score (same formula the quiz uses) */
export function scoreFromSub(sub: SubScores): number {
  const willingness = 0.70 * sub.tolerance + 0.20 * sub.experience + 0.10 * sub.leverageComfort;
  // classic "lesser of willingness / ability", softened so one weak axis doesn't fully dominate
  const blended = 0.60 * Math.min(willingness, sub.capacity) + 0.40 * (willingness + sub.capacity) / 2;
  return Math.round(clamp(blended, 0, 1) * 100);
}

/** turn the raw 0-4 answers into normalised sub-scores + a blended risk score */
export function deriveScores(answers: Record<string, number>): { sub: SubScores; score: number } {
  const g = (k: string) => clamp((answers[k] ?? 0) / 4, 0, 1);
  const avg = (...ks: string[]) => ks.reduce((s, k) => s + g(k), 0) / ks.length;

  const sub: SubScores = {
    horizon: g('horizon'),
    tolerance: avg('drawdown', 'single_shock', 'correlated_crash', 'prolonged'),
    experience: g('experience'),
    leverageComfort: g('leverage'),
    capacity: 0.55 * g('horizon') + 0.30 * g('concentration') + 0.15 * g('goal'),
  };

  return { sub, score: scoreFromSub(sub) };
}

/* --- target volatility glide path ------------------------------------- */
export function targetVolFor(score: number, sub: SubScores): number {
  const base = 0.055 + (0.255 - 0.055) * Math.pow(clamp(score, 0, 100) / 100, 1.15);
  // shorter horizons compress the achievable risk band regardless of appetite
  const horizonCap = 0.06 + 0.20 * sub.horizon;
  return clamp(Math.min(base, horizonCap), 0.05, 0.30);
}

/* --- tilt model: risky sub-portfolio (everything except Bonds/Cash) --- */
const RISKY: Sleeve[] = SLEEVES.filter((s) => s !== 'Bonds/Cash');

export const SECTOR_SLEEVE_MAP: Record<string, Sleeve> = {
  Technology: 'Growth/Tech', Energy: 'Energy', Defense: 'Defense/Aerospace',
  Healthcare: 'Healthcare', Financials: 'Financials',
};

function riskyTilts(sub: SubScores, score: number, sectors: string[]): Record<Sleeve, number> {
  const { tolerance: tol, horizon, capacity, experience, leverageComfort: lev } = sub;
  const s = score / 100;

  const t: Partial<Record<Sleeve, number>> = {
    'Core Broad Market': 40 - 14 * s,
    'Growth/Tech': 9 + 20 * tol + 6 * horizon,
    'International': 9 + 6 * capacity,
    'Small-Cap Satellite': 1 + 13 * tol,
    'Defense/Aerospace': 6 + 5 * (1 - tol),
    'Energy': 4 + 3 * (1 - tol),
    'Healthcare': 5 + 7 * (1 - tol),
    'Financials': 4 + 3 * s,
    // leveraged sleeve is gated: needs explicit comfort, scales hard above the gate
    'Leveraged Equity': lev >= 0.5 ? (lev - 0.5) * 2 * (6 + 26 * tol) : 0,
    // speculative sleeve is gated on BOTH appetite and experience
    'Speculative': tol > 0.6 && experience > 0.5 ? (tol - 0.6) * 2.5 * (3 + 9 * tol) : 0,
  };

  // optional sector overweights from the quiz
  sectors.filter((x) => x && x !== 'none').forEach((sec) => {
    const sl = SECTOR_SLEEVE_MAP[sec];
    if (sl && sl in t) t[sl] = (t[sl] as number) * 1.6 + 4;
  });

  const out = {} as Record<Sleeve, number>;
  RISKY.forEach((sl) => { out[sl] = Math.max(0, t[sl] ?? 0); });
  const sum = RISKY.reduce((a, sl) => a + out[sl], 0) || 1;
  RISKY.forEach((sl) => { out[sl] = out[sl] / sum; });
  return out;
}

/* --- per-sleeve caps (fraction of the WHOLE portfolio) ---------------- */
function sleeveCaps(score: number, sub: SubScores): Partial<Record<Sleeve, number>> {
  const s = score / 100;
  return {
    'Growth/Tech': 0.20 + 0.22 * s,
    'Energy': 0.14,
    'Defense/Aerospace': 0.18,
    'Healthcare': 0.20,
    'Financials': 0.16,
    'Small-Cap Satellite': 0.06 + 0.14 * s,
    'International': 0.28,
    'Leveraged Equity': sub.leverageComfort >= 0.5 ? 0.06 + 0.19 * s * sub.leverageComfort : 0,
    'Speculative': 0.02 + 0.08 * s,
  };
}

/* --- cash floor from the chosen downtrend-handling style -------------- */
export const DOWNTREND_POLICY: Record<string, { cashFloor: number; band: number; rule: string }> = {
  hold:      { cashFloor: 0.00, band: 0.25, rule: 'Buy-and-hold. Rebalance only when a sleeve drifts past its band; no tactical selling.' },
  balanced:  { cashFloor: 0.02, band: 0.20, rule: 'Calendar rebalancing (semi-annual) plus band checks. No hard stop rules.' },
  stop_loss: { cashFloor: 0.05, band: 0.20, rule: 'Band rebalancing plus a -15% trailing stop on any single-name position; proceeds park in Bonds/Cash until redeployed.' },
  tactical:  { cashFloor: 0.08, band: 0.15, rule: 'Tight bands plus a momentum overlay: trim any sleeve whose trailing 12-month return is below -10% and rebuild on recovery.' },
};

/* --- the optimiser ---------------------------------------------------- */
export interface PortfolioWeights { sleeve: Sleeve; weight: number }
export interface OptimizeResult {
  weights: PortfolioWeights[];          // whole-portfolio fractions (sum ~1), weight in %
  targetVol: number;
  achievedVol: number;
  riskyFraction: number;
}

export function optimize(
  score: number, sub: SubScores, sectors: string[], downtrendStyle: string | null,
): OptimizeResult {
  const targetVol = targetVolFor(score, sub);
  const caps = sleeveCaps(score, sub);
  const cashFloor = DOWNTREND_POLICY[downtrendStyle ?? 'balanced']?.cashFloor ?? 0.02;

  let tilts = riskyTilts(sub, score, sectors);
  const cov = covMatrix(SLEEVES);
  const idx: Record<Sleeve, number> = {} as any;
  SLEEVES.forEach((sl, i) => { idx[sl] = i; });

  const volAt = (riskyFrac: number, tw: Record<Sleeve, number>): number => {
    const w = new Array(SLEEVES.length).fill(0);
    w[idx['Bonds/Cash']] = 1 - riskyFrac;
    RISKY.forEach((sl) => { w[idx[sl]] = riskyFrac * tw[sl]; });
    return portfolioVol(w, cov);
  };

  let riskyFrac = 0.6;
  for (let pass = 0; pass < 4; pass++) {
    // bisection on the risky fraction to hit target vol (vol is monotincreasing in riskyFrac)
    let lo = 0, hi = 1 - cashFloor;
    if (volAt(hi, tilts) <= targetVol) { riskyFrac = hi; }
    else if (volAt(lo, tilts) >= targetVol) { riskyFrac = lo; }
    else {
      for (let it = 0; it < 40; it++) {
        const mid = (lo + hi) / 2;
        if (volAt(mid, tilts) < targetVol) lo = mid; else hi = mid;
      }
      riskyFrac = (lo + hi) / 2;
    }

    // apply whole-portfolio caps; push any spill back into the tilt vector and re-solve
    let spill = 0;
    const capped: Record<Sleeve, number> = { ...tilts };
    RISKY.forEach((sl) => {
      const whole = riskyFrac * tilts[sl];
      const cap = caps[sl];
      if (cap !== undefined && whole > cap) {
        spill += whole - cap;
        capped[sl] = riskyFrac > 0 ? cap / riskyFrac : 0;
      }
    });
    if (spill < 1e-4) { tilts = renorm(capped); break; }
    // redistribute spill into uncapped risky sleeves, proportional to current tilt
    const roomSleeves = RISKY.filter((sl) => {
      const cap = caps[sl];
      return cap === undefined || riskyFrac * capped[sl] < cap - 1e-6;
    });
    const roomBase = roomSleeves.reduce((a, sl) => a + capped[sl], 0) || 1;
    roomSleeves.forEach((sl) => { capped[sl] += (spill / riskyFrac) * (capped[sl] / roomBase); });
    tilts = renorm(capped);
  }

  const achievedVol = volAt(riskyFrac, tilts);
  const weights: PortfolioWeights[] = ([
    { sleeve: 'Bonds/Cash' as Sleeve, weight: (1 - riskyFrac) * 100 },
    ...RISKY.map((sl) => ({ sleeve: sl, weight: riskyFrac * tilts[sl] * 100 })),
  ] as PortfolioWeights[]).filter((w) => w.weight > 0.4);

  // final exact renormalisation to 100
  const tot = weights.reduce((a, w) => a + w.weight, 0) || 1;
  weights.forEach((w) => { w.weight = (w.weight / tot) * 100; });

  return { weights, targetVol, achievedVol, riskyFraction: riskyFrac };
}

function renorm(tw: Record<Sleeve, number>): Record<Sleeve, number> {
  const sum = RISKY.reduce((a, sl) => a + Math.max(0, tw[sl]), 0) || 1;
  const out = {} as Record<Sleeve, number>;
  RISKY.forEach((sl) => { out[sl] = Math.max(0, tw[sl]) / sum; });
  return out;
}

/* --- analytics ------------------------------------------------------- */
export interface PortfolioStats {
  expReturn: number;      // arithmetic annual, fraction
  volatility: number;     // annual, fraction
  sharpe: number;
  var95: number;          // 1-yr 95% value-at-risk, fraction (positive number = loss)
  severeDrawdown: number; // estimated peak-to-trough in a bad cycle, fraction (positive = loss)
  yield: number;          // portfolio income yield, fraction
  beta: number;           // vs. Core Broad Market
  leverageExposure: number; // fraction in leveraged + speculative sleeves
}

export function analyse(weights: PortfolioWeights[]): PortfolioStats {
  const order = weights.map((w) => w.sleeve);
  const wv = weights.map((w) => w.weight / 100);
  const cov = covMatrix(order);

  const expReturn = weights.reduce((a, w) => a + (w.weight / 100) * CMA_TABLE[w.sleeve].mu, 0);
  const volatility = portfolioVol(wv, cov);
  const yld = weights.reduce((a, w) => a + (w.weight / 100) * CMA_TABLE[w.sleeve].yield, 0);
  const sharpe = volatility > 0 ? (expReturn - RISK_FREE) / volatility : 0;

  // 1-yr 95% VaR under a lognormal-ish approximation
  const var95 = Math.max(0, 1.645 * volatility - expReturn);

  // severe drawdown heuristic: a rough peak-to-trough for a 1-in-10-yr cycle,
  // penalised for leverage/crypto which draw down non-linearly
  const levExp = weights.reduce(
    (a, w) => a + (w.sleeve === 'Leveraged Equity' || w.sleeve === 'Speculative' ? w.weight / 100 : 0), 0);
  const severeDrawdown = clamp(2.1 * volatility + 0.45 * levExp, 0.03, 0.85);

  const beta = weights.reduce((a, w) => {
    const c = sleeveCorr(w.sleeve, 'Core Broad Market');
    return a + (w.weight / 100) * c * (CMA_TABLE[w.sleeve].sigma / CMA_TABLE['Core Broad Market'].sigma);
  }, 0);

  return {
    expReturn, volatility, sharpe, var95, severeDrawdown, yield: yld, beta,
    leverageExposure: levExp,
  };
}

/* --- a small efficient frontier for the UI -------------------------- */
export interface FrontierPoint { vol: number; ret: number; label?: string }
export function frontier(sub: SubScores, sectors: string[], downtrendStyle: string | null): FrontierPoint[] {
  const pts: FrontierPoint[] = [];
  for (let sc = 5; sc <= 100; sc += 9.5) {
    const r = optimize(sc, sub, sectors, downtrendStyle);
    const st = analyse(r.weights);
    pts.push({ vol: st.volatility, ret: st.expReturn });
  }
  return pts;
}
