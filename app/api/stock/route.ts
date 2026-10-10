import { NextRequest, NextResponse } from 'next/server';

/* ============================================================================
 * /api/stock — live price/volume/range from Yahoo Finance's public chart
 * endpoint (no API key required), layered with qualitative research notes.
 * ----------------------------------------------------------------------------
 * LIVE (from Yahoo, any ticker): price, daily change, 52-week range, volume,
 *   company name, and the full price-history chart (real daily/weekly closes).
 * NOT LIVE (no free, keyless source exists for these — P/E, market cap, beta,
 *   dividend yield, narrative overview, bull/bear case): illustrative research
 *   notes, same for every call. `liveFields` tells the client which is which.
 * ========================================================================== */

const SECTOR_METRICS_MAP: Record<string, any> = {
  LMT: {
    companyName: "Lockheed Martin Corporation", marketCap: "114.2B", peRatio: 17.2, forwardPe: 16.4,
    revenueGrowth: "+4.2%", earningsGrowth: "+6.8%", profitMargin: "8.45%",
    beta: 0.62, dividendYield: "2.75%",
    overview: "Lockheed Martin is a premier security and aerospace company engaged in research, advanced logistics, and state defense integrations.",
    financialTrends: "Predictable long-term funding contracts with steady margin conversion profiles.",
    valuation: "Defensive asset multiple. Strongly supported across market corrections.",
    recentPerformance: "Outperforming growth benchmarks during macro geopolitical tension adjustments.",
    risks: ["Supply chain bottlenecks inside propulsion sectors.", "Procurement delays inside regulatory councils."],
    catalysts: ["Contract awards expected within 180 days.", "Authorizations of joint-state logistics exports."],
    bullCase: ["High state contract visibility provides deep security.", "Dividend stability protects capital allocations."],
    bearCase: ["Mandated defense spending caps limit R&D.", "Asymmetric logistics tools reduce massive weapons reliance."]
  },
  XOM: {
    companyName: "Exxon Mobil Corporation", marketCap: "460.5B", peRatio: 12.4, forwardPe: 11.2,
    revenueGrowth: "+1.8%", earningsGrowth: "+3.2%", profitMargin: "11.12%",
    beta: 0.95, dividendYield: "3.45%",
    overview: "Exxon Mobil is a global leader in energy commodities extraction, crude refining, and chemical processing.",
    financialTrends: "Sustained low exploration break-evens driving balanced organic cash conversions.",
    valuation: "Low double-digit trailing multiples represent substantial cash discount opportunities.",
    recentPerformance: "Trading along key support bands amid crude price adjustments.",
    risks: ["Regulatory carbon caps limit long-term refining output.", "Accelerated infrastructure shifts reduce global demand."],
    catalysts: ["Permian asset cash flow expansions.", "Deep offshore drilling licensing clearances."],
    bullCase: ["Extremely low production cost limits preserve solid margins.", "Aggressive cash share buyback support."],
    bearCase: ["Prolonged global commodities supply expansion compresses exploration spreads.", "Execution lag across deep offshore facilities."]
  },
  DEFAULT: {
    companyName: "Enterprise Tech Corp", marketCap: "2.1T", peRatio: 32.4, forwardPe: 28.5,
    revenueGrowth: "+14.8%", earningsGrowth: "+18.2%", profitMargin: "24.11%",
    beta: 1.18, dividendYield: "0.45%",
    overview: "Global software, cloud platform, and artificial intelligence developer operating enterprise infrastructure services.",
    financialTrends: "Strong double-digit recurring contract subscription revenue flows.",
    valuation: "Growth premium multiple, reflecting immense pricing power.",
    recentPerformance: "Advancing inside a stable ascending channel above short-term support lines.",
    risks: ["Antitrust litigation limits scale and speed.", "Heavy capital expenditures compression margins."],
    catalysts: ["SaaS price increases rollout.", "AI infrastructure enterprise partnerships."],
    bullCase: ["Deep consumer ecosystem locks in recurring cash generation.", "Net cash balance preserves expansion possibilities."],
    bearCase: ["Capex costs limit expected EBITDA acceleration.", "Enterprise client seats optimizations constraint seat growth."]
  }
};

interface ChartPoint { date: string; price: number }

function toPoints(timestamps: number[], closes: number[], dateOpts: Intl.DateTimeFormatOptions): ChartPoint[] {
  const out: ChartPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c === null || c === undefined) continue;
    out.push({ date: new Date(timestamps[i] * 1000).toLocaleDateString('en-US', dateOpts), price: parseFloat(c.toFixed(2)) });
  }
  return out;
}

async function fetchChart(ticker: string, range: string, interval: string) {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.chart?.result?.[0] ?? null;
}

function synthChartData(basePrice: number, points: number): ChartPoint[] {
  const data: ChartPoint[] = [];
  let currentPrice = basePrice * 0.9;
  const now = new Date();
  for (let i = points; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const noise = (Math.random() - 0.48) * (basePrice * 0.02);
    currentPrice = Math.max(1, currentPrice + noise);
    data.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), price: parseFloat(currentPrice.toFixed(2)) });
  }
  return data;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  const ticker = symbol.toUpperCase();
  const baseData = SECTOR_METRICS_MAP[ticker] || { ...SECTOR_METRICS_MAP.DEFAULT, companyName: `${ticker} International Corp` };

  try {
    const [daily, weekly] = await Promise.all([
      fetchChart(ticker.replace('.', '-'), '1y', '1d'),   // Yahoo writes share classes with a hyphen (BRK-B)
      fetchChart(ticker.replace('.', '-'), '5y', '1wk'),
    ]);
    if (!daily) throw new Error('No chart data for symbol');

    const meta = daily.meta;
    const latestPrice: number = meta.regularMarketPrice;
    if (!latestPrice) throw new Error('No live price for symbol');

    const dailyCloses: number[] = daily.indicators?.quote?.[0]?.close ?? [];
    const dailyTimestamps: number[] = daily.timestamp ?? [];

    // NOTE: meta.chartPreviousClose is the close *before the whole requested range started*
    // (e.g. ~1 year ago for range=1y), not yesterday's close — using it for a "daily" change
    // would be wrong. The second-to-last point in the daily series is the actual prior session.
    const lastTwo = dailyCloses.filter((c) => c !== null && c !== undefined);
    const prevClose: number = lastTwo.length >= 2 ? lastTwo[lastTwo.length - 2] : latestPrice;
    const dailyChange = latestPrice - prevClose;
    const dailyChangePct = prevClose
      ? parseFloat(((dailyChange / prevClose) * 100).toFixed(2))
      : (typeof meta.regularMarketChangePercent === 'number' ? parseFloat(meta.regularMarketChangePercent.toFixed(2)) : 0);
    const dayFmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const monthFmt: Intl.DateTimeFormatOptions = { month: 'short', year: '2-digit' };

    const oneYear = toPoints(dailyTimestamps, dailyCloses, dayFmt);
    const oneMonth = oneYear.slice(-22);
    const sixMonth = oneYear.slice(-126);
    const fiveYear = weekly
      ? toPoints(weekly.timestamp ?? [], weekly.indicators?.quote?.[0]?.close ?? [], monthFmt)
      : oneYear;

    const companyName = meta.longName || meta.shortName || baseData.companyName;
    const liveFields = ['price', 'dailyChange', 'dailyChangePct', 'volume', 'chartData'];
    const fiftyTwoWeekRange = (meta.fiftyTwoWeekLow && meta.fiftyTwoWeekHigh)
      ? `$${meta.fiftyTwoWeekLow.toFixed(2)} - $${meta.fiftyTwoWeekHigh.toFixed(2)}`
      : `$${(latestPrice * 0.75).toFixed(2)} - $${(latestPrice * 1.25).toFixed(2)}`;
    if (meta.fiftyTwoWeekLow && meta.fiftyTwoWeekHigh) liveFields.push('fiftyTwoWeekRange');
    if (meta.longName || meta.shortName) liveFields.push('companyName');

    return NextResponse.json({
      ...baseData, ticker, companyName, fiftyTwoWeekRange,
      price: latestPrice, dailyChange, dailyChangePct,
      volume: meta.regularMarketVolume ?? null,
      dayRange: (meta.regularMarketDayLow && meta.regularMarketDayHigh)
        ? `$${meta.regularMarketDayLow.toFixed(2)} - $${meta.regularMarketDayHigh.toFixed(2)}` : null,
      exchange: meta.fullExchangeName ?? null,
      liveFields,
      chartData: { '1M': oneMonth, '6M': sixMonth, '1Y': oneYear, '5Y': fiveYear },
      call_atm: `$${(latestPrice * 0.045).toFixed(2)}`, put_atm: `$${(latestPrice * 0.041).toFixed(2)}`,
      call_otm: `$${(latestPrice * 0.015).toFixed(2)}`, put_otm: `$${(latestPrice * 0.082).toFixed(2)}`
    });
  } catch (error) {
    console.error('Live quote fetch failed, falling back to the synthetic adapter:', error);
  }

  const randPrice = Math.floor(Math.random() * 150) + 100;
  return NextResponse.json({
    ...baseData, ticker, price: randPrice, dailyChange: 2.15, dailyChangePct: 1.25,
    fiftyTwoWeekRange: `$${(randPrice * 0.75).toFixed(2)} - $${(randPrice * 1.25).toFixed(2)}`,
    volume: null, dayRange: null, exchange: null, liveFields: [],
    chartData: {
      '1M': synthChartData(randPrice, 30), '6M': synthChartData(randPrice, 180),
      '1Y': synthChartData(randPrice, 365), '5Y': synthChartData(randPrice, 1825),
    },
    call_atm: `$${(randPrice * 0.045).toFixed(2)}`, put_atm: `$${(randPrice * 0.041).toFixed(2)}`,
    call_otm: `$${(randPrice * 0.015).toFixed(2)}`, put_otm: `$${(randPrice * 0.082).toFixed(2)}`
  });
}
