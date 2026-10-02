'use client';

import React, { useState } from 'react';
import { Briefcase, DollarSign, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { CATEGORY_NOTES, DOWNTREND_STYLE_LABEL, VEHICLE_LABEL, RiskProfile } from '../lib/quiz';
import { CMA_SOURCES } from '../lib/portfolio';
import PortfolioModeler from './PortfolioModeler';
import {
  ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis, Tooltip, ZAxis, CartesianGrid,
} from 'recharts';

const pctS = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

export default function PortfolioView({
  profile, balance, onRetake, onBalanceChange, onProfileChange,
}: {
  profile: RiskProfile | null; balance: number; onRetake: () => void;
  onBalanceChange: (n: number) => void; onProfileChange: (p: RiskProfile) => void;
}) {
  const [balanceInput, setBalanceInput] = useState(String(balance));
  const [showModeler, setShowModeler] = useState(false);

  React.useEffect(() => { setBalanceInput(String(balance)); }, [balance]);

  if (!profile) return null;
  const { score, bucket, blurb, allocation, vehicle, sectors, downtrendStyle } = profile;
  const totalValue = balance;
  const st = allocation.stats;

  const commitBalance = () => {
    const n = parseFloat(balanceInput.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n) && n >= 0) onBalanceChange(n); else setBalanceInput(String(balance));
  };

  const frontierData = allocation.frontier.map((p) => ({ vol: +(p.vol * 100).toFixed(2), ret: +(p.ret * 100).toFixed(2) }));
  const youData = [{ vol: +(st.volatility * 100).toFixed(2), ret: +(st.expReturn * 100).toFixed(2) }];
  const allX = [...frontierData.map((p) => p.vol), youData[0].vol];
  const allY = [...frontierData.map((p) => p.ret), youData[0].ret];
  const xDom: [number, number] = [Math.floor(Math.min(...allX) - 1), Math.ceil(Math.max(...allX) + 1)];
  const yDom: [number, number] = [Math.floor(Math.min(...allY) - 0.5), Math.ceil(Math.max(...allY) + 0.5)];

  return (
    <div className="space-y-6">
      <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2"><Briefcase size={16} className="text-[#58a6ff]" /> Algorithmic Target Portfolio</h2>
          <p className="text-[10px] text-slate-400 uppercase mt-0.5">Risk-targeted at {pctS(allocation.targetVol)} volatility — not investment advice</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center bg-[#090d13] border border-[#252e38] rounded-sm px-2 py-1.5">
            <DollarSign size={12} className="text-[#58a6ff] mr-1" />
            <label htmlFor="balance-input" className="sr-only">Account balance</label>
            <input
              id="balance-input" type="text" inputMode="decimal" value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)} onBlur={commitBalance}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="w-28 bg-transparent text-white text-xs font-mono focus:outline-none"
            />
          </div>
          <button onClick={() => setShowModeler((v) => !v)} className="bg-[#21262d] border border-[#58a6ff] text-[#58a6ff] px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm flex items-center gap-1.5">
            <SlidersHorizontal size={12} /> Model It {showModeler ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button onClick={onRetake} className="bg-[#21262d] border border-[#252e38] hover:bg-[#30363d] text-white px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm">Retake Quiz</button>
        </div>
      </div>

      {showModeler && <PortfolioModeler profile={profile} onApply={onProfileChange} />}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-[#121820] p-4 border border-[#252e38] rounded"><span className="text-[10px] text-slate-400 font-bold uppercase block">Risk Score</span><span className="text-xl font-bold text-white block mt-1">{score}/100</span></div>
        <div className="bg-[#121820] p-4 border border-[#252e38] rounded"><span className="text-[10px] text-slate-400 font-bold uppercase block">Profile</span><span className="text-sm font-bold text-[#58a6ff] block mt-1 leading-tight">{bucket}</span></div>
        <div className="bg-[#121820] p-4 border border-[#252e38] rounded"><span className="text-[10px] text-slate-400 font-bold uppercase block">Est. Beta</span><span className="text-xl font-bold text-white block mt-1">{allocation.estBeta}x</span></div>
        <div className="bg-[#121820] p-4 border border-[#252e38] rounded"><span className="text-[10px] text-slate-400 font-bold uppercase block">Vehicle</span><span className="text-xs font-bold text-white block mt-1.5 leading-tight">{VEHICLE_LABEL[vehicle] || 'Mix'}</span></div>
        <div className="bg-[#121820] p-4 border border-[#252e38] rounded"><span className="text-[10px] text-slate-400 font-bold uppercase block">Downtrend Style</span><span className="text-xs font-bold text-white block mt-1.5 leading-tight">{downtrendStyle ? DOWNTREND_STYLE_LABEL[downtrendStyle] : 'N/A'}</span></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-[#121820] p-3 border border-[#252e38] rounded text-xs">
        {[
          { l: 'Exp. Return', v: `${pctS(st.expReturn)}/yr`, c: '#4ade80' },
          { l: 'Volatility', v: `${pctS(st.volatility)} (tgt ${pctS(allocation.targetVol)})`, c: '#fb923c' },
          { l: 'Sharpe', v: st.sharpe.toFixed(2), c: '#c9d1d9' },
          { l: 'Income Yield', v: pctS(st.yield), c: '#4ade80' },
          { l: '1-yr 95% VaR', v: `-${pctS(st.var95)}`, c: '#f87171' },
          { l: 'Severe Drawdown', v: `-${pctS(st.severeDrawdown)}`, c: '#f87171' },
        ].map((m, i) => (
          <div key={m.l} className={`pr-2 ${i < 5 ? 'sm:border-r sm:border-[#252e38]' : ''}`}>
            <span className="text-slate-400 text-[9px] uppercase font-bold block">{m.l}</span>
            <p className="font-bold mt-0.5" style={{ color: m.c }}>{m.v}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 italic">{blurb} {sectors && sectors.length > 0 && <span>Overweighting: {sectors.join(', ')}.</span>}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-[#252e38] pb-1.5 mb-3">Sleeve / Category Weighting</h3>
          <div className="space-y-2.5">
            {[...allocation.categories].sort((a, b) => b.weight - a.weight).map(c => (
              <div key={c.category}>
                <div className="flex justify-between text-xs mb-1"><span className="font-bold text-white">{c.category}</span><span className="text-slate-400">{c.weight.toFixed(1)}%</span></div>
                <div className="w-full h-2 bg-[#090d13] rounded-full overflow-hidden border border-[#252e38]"><div className="h-full bg-[#58a6ff]" style={{ width: `${c.weight}%` }} /></div>
                <p className="text-[10px] text-slate-400 mt-1">{CATEGORY_NOTES[c.category]}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-[#252e38] pb-1.5 mb-3">Efficient Frontier — your portfolio vs. the risk glide path</h3>
          <div className="relative w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 12, left: -8, bottom: 4 }}>
                <CartesianGrid stroke="#252e38" strokeDasharray="2 2" />
                <XAxis type="number" dataKey="vol" name="Volatility" unit="%" stroke="#8b949e" tick={{ fontSize: 9 }} domain={xDom} allowDecimals={false} />
                <YAxis type="number" dataKey="ret" name="Return" unit="%" stroke="#8b949e" tick={{ fontSize: 9 }} domain={yDom} allowDecimals={false} />
                <ZAxis type="number" dataKey="z" range={[50, 320]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#121820', borderColor: '#252e38', fontSize: 11, color: '#c9d1d9' }} formatter={(v: number) => `${v}%`} />
                <Scatter data={frontierData.map((d) => ({ ...d, z: 1 }))} line={{ stroke: '#8b949e', strokeWidth: 1.5 }} lineType="joint" fill="#8b949e" name="Glide path" shape="circle" />
                <Scatter data={youData.map((d) => ({ ...d, z: 4 }))} fill="#58a6ff" name="Your portfolio" shape="circle" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Blue dot = your risk-targeted portfolio. The line is the set of portfolios the engine would build across the full 0–100 risk range.</p>
        </div>
      </div>

      <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm">
        <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-[#252e38] pb-1.5 mb-3">Target Holdings (based on ${totalValue.toLocaleString()} balance)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead><tr className="border-b border-[#252e38] text-slate-400 font-bold"><th className="pb-2">TICKER</th><th className="pb-2">CATEGORY</th><th className="pb-2">WEIGHT</th><th className="pb-2 text-right">TARGET $</th></tr></thead>
            <tbody>
              {[...allocation.holdings].sort((a, b) => b.weight - a.weight).map((h, i) => (
                <tr key={`${h.ticker}-${i}`} className="border-b border-[#252e38] hover:bg-[#161b22]/50">
                  <td className="py-2 font-bold text-white">{h.ticker}{h.note && <span className="text-[9px] text-slate-400 font-normal block">{h.note}</span>}</td>
                  <td className="py-2 text-slate-400">{h.category}</td>
                  <td className="py-2">{h.weight.toFixed(1)}%</td>
                  <td className="py-2 text-right">${((h.weight / 100) * totalValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm text-xs text-slate-400 leading-relaxed">
        <span className="font-bold text-white uppercase text-[10px] block mb-1">Rebalancing policy</span>
        {allocation.rebalancing.rule} Rebalance when a sleeve drifts more than ±{(allocation.rebalancing.band * 100).toFixed(0)}% (relative) from target. Cash floor {pctS(allocation.rebalancing.cashFloor)}.
      </div>

      <div className="bg-orange-950/20 border border-orange-900/50 p-3 rounded text-[10px] text-orange-200 leading-relaxed">
        <strong>Note:</strong> Leveraged and speculative positions amplify both gains and losses and can decay significantly in volatile, sideways markets. Expected return / volatility / drawdown figures are long-run modelling estimates, not forecasts. This tool is educational — verify any allocation against your own research before acting on it.
      </div>

      <p className="text-[9px] text-slate-400 leading-relaxed">
        Core, International and Bonds/Cash return assumptions: {CMA_SOURCES.citation} Leveraged Equity is derived from the Core assumption via the leveraged-ETF decay formula, not separately assumed. Sector sleeves are modeled as spreads off Core; see the Thesis Builder for the full methodology note.
      </p>
    </div>
  );
}
