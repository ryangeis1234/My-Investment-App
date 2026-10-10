/* ============================================================================
 * backtest.ts — constant-mix historical backtest on aligned weekly prices
 * ----------------------------------------------------------------------------
 * Given target weights and weekly price history per ticker, replays the
 * portfolio over the longest window where every (kept) ticker has data,
 * rebalancing back to target weights on a fixed schedule, and compares it to
 * a single benchmark ticker. Pure functions — the API route only fetches data.
 * Ignores trading costs, taxes and slippage by design (disclosed in the UI).
 * ========================================================================== */

export interface PricePoint { t: number; close: number }   // t = unix seconds
export interface BacktestStats { totalReturn: number; annReturn: number; annVol: number; maxDrawdown: number }
export interface BacktestResult {
  dates: string[];
  portfolio: number[];   // indexed to 100 at the start
  benchmark: number[];   // indexed to 100 at the start
  portfolioStats: BacktestStats;
  benchmarkStats: BacktestStats;
  usedTickers: string[];
  droppedTickers: string[];
  weeks: number;
}

const WEEKS_PER_YEAR = 52;
const dayKey = (t: number) => Math.floor(t / 86400);

/** timestamps (as day numbers) present in every one of the given series, ascending */
function commonDays(series: PricePoint[][]): number[] {
  const counts = new Map<number, number>();
  series.forEach((s) => {
    const seen = new Set<number>();
    s.forEach((p) => {
      const k = dayKey(p.t);
      if (!seen.has(k)) { seen.add(k); counts.set(k, (counts.get(k) ?? 0) + 1); }
    });
  });
  return Array.from(counts.entries()).filter(([, c]) => c === series.length).map(([k]) => k).sort((a, b) => a - b);
}

export function seriesStats(values: number[]): BacktestStats {
  const n = values.length - 1;
  if (n < 1) return { totalReturn: 0, annReturn: 0, annVol: 0, maxDrawdown: 0 };
  const rets: number[] = [];
  for (let i = 1; i < values.length; i++) rets.push(values[i] / values[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(rets.length - 1, 1);
  let peak = values[0], maxDd = 0;
  values.forEach((v) => { peak = Math.max(peak, v); maxDd = Math.min(maxDd, v / peak - 1); });
  const total = values[n] / values[0];
  return {
    totalReturn: total - 1,
    annReturn: Math.pow(total, WEEKS_PER_YEAR / n) - 1,
    annVol: Math.sqrt(variance) * Math.sqrt(WEEKS_PER_YEAR),
    maxDrawdown: maxDd,
  };
}

export function runBacktest(
  weights: Record<string, number>,
  series: Record<string, PricePoint[] | null>,
  benchmark: string,
  rebalanceEvery = 13,
  minWeeks = 52,
): BacktestResult | null {
  const bench = series[benchmark];
  if (!bench || bench.length < 2) return null;

  const dropped: string[] = [];
  let used = Object.keys(weights).filter((t) => {
    const ok = !!series[t] && (series[t] as PricePoint[]).length >= 2 && weights[t] > 0;
    if (!ok) dropped.push(t);
    return ok;
  });

  // keep dropping whichever holding has the shortest history until the shared window is long enough
  let days: number[] = [];
  while (used.length > 0) {
    days = commonDays([bench, ...used.map((t) => series[t] as PricePoint[])]);
    if (days.length - 1 >= minWeeks || used.length === 1) break;
    const latestStart = used.reduce((a, b) =>
      dayKey((series[a] as PricePoint[])[0].t) >= dayKey((series[b] as PricePoint[])[0].t) ? a : b);
    dropped.push(latestStart);
    used = used.filter((t) => t !== latestStart);
  }
  if (used.length === 0 || days.length < 3) return null;

  const closeAt = (pts: PricePoint[]) => {
    const m = new Map<number, number>();
    pts.forEach((p) => m.set(dayKey(p.t), p.close));
    return days.map((d) => m.get(d) as number);
  };
  const closes = used.map((t) => closeAt(series[t] as PricePoint[]));
  const benchCloses = closeAt(bench);

  const totalW = used.reduce((a, t) => a + weights[t], 0);
  const w = used.map((t) => weights[t] / totalW);

  let holdings = w.map((x) => x * 100);
  const portfolio = [100];
  for (let k = 1; k < days.length; k++) {
    holdings = holdings.map((h, i) => h * (closes[i][k] / closes[i][k - 1]));
    const total = holdings.reduce((a, b) => a + b, 0);
    if (k % rebalanceEvery === 0) holdings = w.map((x) => x * total);
    portfolio.push(total);
  }
  const benchmarkIdx = benchCloses.map((c) => (c / benchCloses[0]) * 100);

  return {
    dates: days.map((d) => new Date(d * 86400 * 1000).toISOString().slice(0, 10)),
    portfolio, benchmark: benchmarkIdx,
    portfolioStats: seriesStats(portfolio),
    benchmarkStats: seriesStats(benchmarkIdx),
    usedTickers: used, droppedTickers: dropped,
    weeks: days.length - 1,
  };
}
