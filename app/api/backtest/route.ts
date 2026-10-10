import { NextRequest, NextResponse } from 'next/server';
import { runBacktest, PricePoint } from '../../../lib/backtest';

/* ============================================================================
 * /api/backtest?weights=VOO:20,QQQ:15,Cash:5 — replays the given mix over up to
 * 5 years of real weekly prices from Yahoo Finance (dividend-adjusted closes,
 * no API key) and compares it to the S&P 500 (VOO).
 * "Cash" is proxied by BIL, a 1-3 month Treasury bill ETF.
 * ========================================================================== */

const BENCHMARK = 'VOO';
const MAX_TICKERS = 25;

const toYahooSymbol = (t: string) => (t.toUpperCase() === 'CASH' ? 'BIL' : t.toUpperCase().replace('.', '-'));

async function fetchSeries(ticker: string): Promise<PricePoint[] | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1wk&range=5y&events=div%7Csplit`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const r = json.chart?.result?.[0];
    if (!r) return null;
    const timestamps: number[] = r.timestamp ?? [];
    const closes: (number | null)[] = r.indicators?.adjclose?.[0]?.adjclose ?? r.indicators?.quote?.[0]?.close ?? [];
    const pts: PricePoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (typeof c === 'number' && c > 0) pts.push({ t: timestamps[i], close: c });
    }
    return pts.length >= 2 ? pts : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const raw = new URL(request.url).searchParams.get('weights');
  if (!raw) return NextResponse.json({ error: 'weights is required, e.g. weights=VOO:60,BND:40' }, { status: 400 });

  const weights: Record<string, number> = {};
  raw.split(',').slice(0, MAX_TICKERS * 2).forEach((pair) => {
    const [t, w] = pair.split(':');
    const weight = parseFloat(w);
    if (!t || !Number.isFinite(weight) || weight <= 0) return;
    const sym = toYahooSymbol(t.trim());
    weights[sym] = (weights[sym] ?? 0) + weight;
  });
  const tickers = Object.keys(weights).slice(0, MAX_TICKERS);
  if (tickers.length === 0) return NextResponse.json({ error: 'No valid holdings supplied' }, { status: 400 });

  const all = Array.from(new Set([BENCHMARK, ...tickers]));
  const fetched = await Promise.all(all.map(async (t) => [t, await fetchSeries(t)] as const));
  const series: Record<string, PricePoint[] | null> = Object.fromEntries(fetched);

  const result = runBacktest(weights, series, BENCHMARK);
  if (!result) {
    return NextResponse.json({ error: 'Could not build a backtest — price history was unavailable.' }, { status: 502 });
  }
  return NextResponse.json({ ...result, benchmarkTicker: BENCHMARK, live: true });
}
