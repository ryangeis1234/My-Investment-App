'use client';

import React, { useState } from 'react';
import { History, RefreshCw, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { AllocationHolding } from '../lib/quiz';
import { BacktestResult, BacktestStats } from '../lib/backtest';

const pct = (x: number, d = 1) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(d)}%`;
const plain = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

export default function BacktestPanel({ holdings }: { holdings: AllocationHolding[] }) {
  const [result, setResult] = useState<(BacktestResult & { benchmarkTicker: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const weights = holdings.map((h) => `${encodeURIComponent(h.ticker)}:${h.weight.toFixed(3)}`).join(',');
      const res = await fetch(`/api/backtest?weights=${weights}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backtest failed');
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Backtest failed');
    } finally {
      setLoading(false);
    }
  };

  const chartData = result ? result.dates.map((d, i) => ({ date: d, portfolio: +result.portfolio[i].toFixed(2), benchmark: +result.benchmark[i].toFixed(2) })) : [];
  const rows: { label: string; f: (s: BacktestStats) => string }[] = [
    { label: 'Total return', f: (s) => pct(s.totalReturn) },
    { label: 'Annualized return', f: (s) => pct(s.annReturn) },
    { label: 'Volatility (annual)', f: (s) => plain(s.annVol) },
    { label: 'Worst drop (max drawdown)', f: (s) => plain(s.maxDrawdown) },
  ];

  let takeaway = '';
  if (result) {
    const diff = (result.portfolioStats.maxDrawdown - result.benchmarkStats.maxDrawdown) * 100;
    takeaway = diff >= 0
      ? `In this window your mix's worst drop was ${diff.toFixed(1)} points shallower than the S&P 500's.`
      : `In this window your mix's worst drop was ${Math.abs(diff).toFixed(1)} points deeper than the S&P 500's — higher-risk profiles are expected to swing more.`;
  }

  return (
    <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#252e38] pb-2">
        <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2"><History size={14} className="text-[#58a6ff]" /> Historical Backtest — would this mix have worked?</h3>
        <button onClick={run} disabled={loading} className="bg-[#21262d] border border-[#58a6ff] text-[#58a6ff] px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm flex items-center justify-center gap-1.5 disabled:opacity-50">
          {loading ? <><RefreshCw size={12} className="animate-spin" /> Running…</> : result ? 'Re-run' : 'Run backtest on real prices'}
        </button>
      </div>

      {!result && !loading && !error && (
        <p className="text-[11px] text-slate-400 leading-relaxed">Replays your current holdings over up to 5 years of real weekly prices from Yahoo Finance and compares them with the S&P 500. Click the button to run it.</p>
      )}
      {error && <div className="bg-red-950/40 border border-red-900 text-[#f87171] p-3 rounded text-xs flex items-center gap-2"><AlertTriangle size={14} /> {error}</div>}

      {result && (
        <div className="space-y-4">
          <div className="relative w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#252e38" strokeDasharray="2 2" />
                <XAxis dataKey="date" stroke="#8b949e" tick={{ fontSize: 9 }} tickFormatter={(d: string) => d.slice(0, 7)} minTickGap={40} />
                <YAxis stroke="#8b949e" tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#121820', borderColor: '#252e38', fontSize: 11, color: '#c9d1d9' }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="portfolio" name="Your portfolio" stroke="#58a6ff" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="benchmark" name={`S&P 500 (${result.benchmarkTicker})`} stroke="#8b949e" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead><tr className="border-b border-[#252e38] text-slate-400 font-bold"><th className="pb-2">METRIC</th><th className="pb-2 text-right">YOUR PORTFOLIO</th><th className="pb-2 text-right">S&amp;P 500</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-[#252e38]/60">
                    <td className="py-1.5 text-slate-300">{r.label}</td>
                    <td className="py-1.5 text-right font-bold text-white">{r.f(result.portfolioStats)}</td>
                    <td className="py-1.5 text-right text-slate-400">{r.f(result.benchmarkStats)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-white leading-relaxed">{takeaway}</p>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Window: {result.dates[0]} to {result.dates[result.dates.length - 1]} ({result.weeks} weeks). Rebalanced quarterly to target weights; dividend-adjusted prices; Cash is proxied by a Treasury-bill ETF (BIL); no trading costs or taxes.
            {result.droppedTickers.length > 0 && <> Left out for lack of history: {result.droppedTickers.join(', ')} (remaining weights rescaled).</>}
            {' '}Past performance does not predict future results.
          </p>
        </div>
      )}
    </div>
  );
}
