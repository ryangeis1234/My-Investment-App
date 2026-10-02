'use client';

import React, { useMemo, useState } from 'react';
import { SlidersHorizontal, RotateCcw, Check } from 'lucide-react';
import {
  RiskProfile, computeAllocation, scoreToProfile, scoreFromSub, SubScores,
  SECTOR_CATEGORY_MAP, DOWNTREND_STYLE_LABEL,
} from '../lib/quiz';
import { applyStockPicks } from '../lib/stocks';

const DIM_LABEL: Record<keyof SubScores, string> = {
  horizon: 'Time Horizon', tolerance: 'Loss Composure', capacity: 'Risk Capacity',
  experience: 'Experience', leverageComfort: 'Leverage Comfort',
};
const DIMS = Object.keys(DIM_LABEL) as (keyof SubScores)[];

const STAT_LABEL: Record<'expReturn' | 'volatility' | 'sharpe' | 'severeDrawdown', string> = {
  expReturn: 'Expected Return', volatility: 'Volatility', sharpe: 'Sharpe Ratio', severeDrawdown: 'Severe Drawdown',
};

function buildAllocation(profile: RiskProfile, sub: SubScores, sectors: string[], downtrendStyle: string) {
  const alloc = computeAllocation(0, profile.vehicle, sectors, undefined, downtrendStyle, sub);
  return profile.selectedStocks?.length ? applyStockPicks(alloc, profile.selectedStocks) : alloc;
}

export default function PortfolioModeler({ profile, onApply }: { profile: RiskProfile; onApply: (updated: RiskProfile) => void }) {
  const [sub, setSub] = useState<SubScores>(profile.allocation.subScores);
  const [sectors, setSectors] = useState<string[]>(profile.sectors);
  const [downtrendStyle, setDowntrendStyle] = useState(profile.downtrendStyle || 'balanced');
  const [applied, setApplied] = useState(false);

  const modeled = useMemo(() => buildAllocation(profile, sub, sectors, downtrendStyle), [profile, sub, sectors, downtrendStyle]);
  const score = scoreFromSub(sub);
  const { bucket } = scoreToProfile(score);

  const dirty = JSON.stringify(sub) !== JSON.stringify(profile.allocation.subScores)
    || JSON.stringify([...sectors].sort()) !== JSON.stringify([...profile.sectors].sort())
    || downtrendStyle !== (profile.downtrendStyle || 'balanced');

  const setDim = (dim: keyof SubScores, v: number) => { setSub(s => ({ ...s, [dim]: v / 100 })); setApplied(false); };
  const toggleSector = (key: string) => {
    setSectors(prev => prev.includes(key) ? prev.filter(s => s !== key) : prev.length >= 2 ? prev : [...prev, key]);
    setApplied(false);
  };

  // finite-difference sensitivity: which sub-score dimension moves this stat the most, and which way
  const sensitivities = useMemo(() => {
    const step = 0.22;
    const out: Record<string, { dim: keyof SubScores; positive: boolean }> = {};
    (Object.keys(STAT_LABEL) as (keyof typeof STAT_LABEL)[]).forEach((statKey) => {
      const effects = DIMS.map((dim) => {
        const hi = { ...sub, [dim]: Math.min(1, sub[dim] + step) };
        const lo = { ...sub, [dim]: Math.max(0, sub[dim] - step) };
        const vHi = buildAllocation(profile, hi, sectors, downtrendStyle).stats[statKey];
        const vLo = buildAllocation(profile, lo, sectors, downtrendStyle).stats[statKey];
        return { dim, effect: vHi - vLo };
      });
      const best = effects.reduce((a, b) => (Math.abs(b.effect) > Math.abs(a.effect) ? b : a));
      out[statKey] = { dim: best.dim, positive: best.effect > 0 };
    });
    return out;
  }, [sub, sectors, downtrendStyle, profile]);

  const handleApply = () => {
    const { blurb } = scoreToProfile(score);
    onApply({
      ...profile, score, bucket, blurb, sectors, downtrendStyle, allocation: modeled, generated_at: new Date().toISOString(),
    });
    setApplied(true);
  };
  const handleReset = () => {
    setSub(profile.allocation.subScores); setSectors(profile.sectors); setDowntrendStyle(profile.downtrendStyle || 'balanced'); setApplied(false);
  };

  const st = modeled.stats;
  const pctS = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

  return (
    <div className="terminal-card p-4 rounded-sm space-y-5">
      <div className="flex justify-between items-center border-b border-[#252e38] pb-2">
        <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5"><SlidersHorizontal size={14} className="text-[#58a6ff]" /> Model It — {bucket} ({score}/100)</h3>
        <div className="flex gap-2">
          <button onClick={handleReset} className="text-[9px] text-slate-400 hover:text-white font-bold uppercase flex items-center gap-1"><RotateCcw size={11} /> Reset</button>
          <button
            onClick={handleApply}
            disabled={!dirty && !applied}
            className={`px-3 py-1 text-[9px] font-bold uppercase rounded-sm border flex items-center gap-1.5 ${applied ? 'bg-green-950 border-green-800 text-[#4ade80]' : 'bg-[#21262d] border-[#58a6ff] text-[#58a6ff]'} disabled:opacity-40`}
          >
            {applied ? <><Check size={11} /> Applied</> : 'Apply This Model'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {DIMS.map((dim) => (
            <div key={dim}>
              <div className="flex justify-between text-[10px] mb-1"><span className="text-slate-400 font-bold uppercase">{DIM_LABEL[dim]}</span><span className="text-white font-bold">{Math.round(sub[dim] * 100)}</span></div>
              <input type="range" min={0} max={100} value={Math.round(sub[dim] * 100)} onChange={(e) => setDim(dim, parseInt(e.target.value, 10))} className="w-full accent-[#58a6ff]" />
            </div>
          ))}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Sector overweight (up to 2)</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(SECTOR_CATEGORY_MAP).map((sec) => (
                <button
                  key={sec} onClick={() => toggleSector(sec)}
                  className={`px-2 py-1 text-[10px] font-bold rounded-sm border ${sectors.includes(sec) ? 'bg-[#21262d] border-[#58a6ff] text-[#58a6ff]' : 'bg-[#090d13] border-[#252e38] text-slate-400'}`}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Downtrend style</span>
            <select value={downtrendStyle} onChange={(e) => { setDowntrendStyle(e.target.value); setApplied(false); }} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm">
              {Object.entries(DOWNTREND_STYLE_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2.5">
          {[
            { key: 'expReturn' as const, value: pctS(st.expReturn) },
            { key: 'volatility' as const, value: pctS(st.volatility) },
            { key: 'sharpe' as const, value: st.sharpe.toFixed(2) },
            { key: 'severeDrawdown' as const, value: `-${pctS(st.severeDrawdown)}` },
          ].map(({ key, value }) => {
            const s = sensitivities[key];
            return (
              <div key={key} className="bg-[#090d13] p-2.5 border border-[#252e38] rounded-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">{STAT_LABEL[key]}</span>
                  <span className="text-sm font-bold text-white">{value}</span>
                </div>
                {s && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    {s.positive ? '↑' : '↓'} Raise <strong className="text-[#58a6ff]">{DIM_LABEL[s.dim]}</strong> to {s.positive ? 'increase' : 'decrease'} this — lower it to {s.positive ? 'decrease' : 'increase'} it.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
