'use client';

import React, { useMemo, useState } from 'react';
import { Sparkles, RefreshCw, Save, Check, AlertTriangle, TrendingUp, ShieldAlert, Target, Layers } from 'lucide-react';
import { RiskProfile } from '../lib/quiz';
import { generateThesis, thesisToRecord, GeneratedThesis } from '../lib/thesis';
import { dbService } from '../utils/api';

export default function ThesisBuilder({ profile, onRetake }: { profile: RiskProfile | null; onRetake: () => void }) {
  const [nonce, setNonce] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const thesis: GeneratedThesis | null = useMemo(
    () => (profile ? generateThesis(profile) : null),
    [profile, nonce],
  );

  if (!profile || !thesis) {
    return (
      <div className="terminal-card p-6 rounded-sm text-center max-w-xl mx-auto my-12">
        <Sparkles className="w-10 h-10 text-[#58a6ff] mx-auto mb-3" />
        <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-1">No risk profile yet</h2>
        <p className="text-[10px] text-slate-400 uppercase">Complete the risk quiz first — the thesis is generated from your profile.</p>
      </div>
    );
  }

  const handleSave = async () => {
    setSaveState('saving');
    try {
      await dbService.createThesis(thesisToRecord(profile, thesis));
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3500);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3500);
    }
  };

  const st = profile.allocation.stats;

  return (
    <div className="space-y-6">
      <div className="terminal-card p-4 rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2"><Sparkles size={16} className="text-[#58a6ff]" /> Investment Thesis Builder</h2>
          <p className="text-[10px] text-slate-400 uppercase mt-0.5">Auto-drafted from your {profile.bucket} profile ({profile.score}/100) — deterministic, numbers-backed</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setNonce((n) => n + 1)} className="bg-[#21262d] border border-[#252e38] hover:bg-[#30363d] text-white px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm flex items-center gap-1.5"><RefreshCw size={12} className="text-[#58a6ff]" /> Regenerate</button>
          <button onClick={onRetake} className="bg-[#21262d] border border-[#252e38] hover:bg-[#30363d] text-white px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm">Retake Quiz</button>
          <button
            onClick={handleSave}
            disabled={saveState === 'saving'}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm flex items-center gap-1.5 border transition-all ${
              saveState === 'saved' ? 'bg-green-950 border-green-800 text-[#4ade80]'
              : saveState === 'error' ? 'bg-red-950 border-red-800 text-[#f87171]'
              : 'bg-[#21262d] border-[#252e38] hover:bg-[#30363d] text-white'
            }`}
          >
            {saveState === 'saved' ? <><Check size={12} /> Saved to Tracker</>
              : saveState === 'error' ? <><AlertTriangle size={12} /> Save failed</>
              : <><Save size={12} className="text-[#58a6ff]" /> {saveState === 'saving' ? 'Saving…' : 'Save to Thesis Tracker'}</>}
          </button>
        </div>
      </div>

      <div className="terminal-card p-5 rounded-sm space-y-4">
        <div className="flex items-start gap-3 border-b border-[#252e38] pb-3">
          <Target size={18} className="text-[#58a6ff] mt-0.5 shrink-0" />
          <div>
            <h1 className="text-base font-bold text-white leading-tight">{thesis.headline}</h1>
            <p className="text-[10px] text-slate-400 uppercase mt-1 font-mono">Horizon: {thesis.horizon} · generated {new Date(thesis.generatedAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            { l: 'Exp. Return', v: `${(st.expReturn * 100).toFixed(1)}%` },
            { l: 'Volatility', v: `${(st.volatility * 100).toFixed(1)}%` },
            { l: 'Sharpe', v: st.sharpe.toFixed(2) },
            { l: 'Severe DD', v: `-${(st.severeDrawdown * 100).toFixed(1)}%` },
          ].map((m) => (
            <div key={m.l} className="bg-[#090d13] p-2.5 border border-[#252e38] rounded-sm">
              <span className="text-[9px] text-slate-400 uppercase font-bold block">{m.l}</span>
              <span className="text-sm font-bold text-white">{m.v}</span>
            </div>
          ))}
        </div>

        <section>
          <h3 className="text-[10px] font-bold text-[#58a6ff] uppercase tracking-widest mb-1.5">Objective</h3>
          <p className="text-xs text-slate-300 leading-relaxed">{thesis.objective}</p>
        </section>

        <section>
          <h3 className="text-[10px] font-bold text-[#58a6ff] uppercase tracking-widest mb-1.5">Strategic Summary</h3>
          <p className="text-xs text-slate-300 leading-relaxed">{thesis.summary}</p>
        </section>
      </div>

      <div className="terminal-card p-5 rounded-sm">
        <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5 border-b border-[#252e38] pb-2 mb-3"><Layers size={14} className="text-[#58a6ff]" /> Positioning &amp; Rationale</h3>
        <div className="space-y-3">
          {thesis.positioning.map((p) => (
            <div key={p.sleeve} className="bg-[#090d13] p-3 border border-[#252e38] rounded-sm">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-white">{p.sleeve}</span>
                <span className="text-[11px] font-bold text-[#58a6ff] font-mono">{p.weight.toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#121820] rounded-full overflow-hidden border border-[#252e38] mb-2"><div className="h-full bg-[#58a6ff]" style={{ width: `${Math.min(100, p.weight)}%` }} /></div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{p.rationale}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="terminal-card p-5 rounded-sm">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5 border-b border-[#252e38] pb-2 mb-3"><TrendingUp size={14} className="text-[#4ade80]" /> Catalysts</h3>
          <ul className="space-y-2 text-[11px] text-slate-300 list-disc list-inside leading-relaxed">
            {thesis.catalysts.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
        <div className="terminal-card p-5 rounded-sm">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5 border-b border-[#252e38] pb-2 mb-3"><ShieldAlert size={14} className="text-[#f87171]" /> Key Risks</h3>
          <ul className="space-y-2 text-[11px] text-slate-300 list-disc list-inside leading-relaxed">
            {thesis.keyRisks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      </div>

      <div className="terminal-card p-5 rounded-sm space-y-3">
        <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-[#252e38] pb-2">Monitoring &amp; Invalidation Triggers</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
          <div className="bg-[#090d13] p-3 border border-[#252e38] rounded-sm">
            <span className="text-[9px] font-bold text-[#4ade80] uppercase tracking-wider block mb-1">Strengthening</span>
            <p className="text-slate-400 leading-relaxed">{thesis.strengthening}</p>
          </div>
          <div className="bg-[#090d13] p-3 border border-[#252e38] rounded-sm">
            <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block mb-1">Weakening</span>
            <p className="text-slate-400 leading-relaxed">{thesis.weakening}</p>
          </div>
          <div className="bg-[#090d13] p-3 border border-[#252e38] rounded-sm">
            <span className="text-[9px] font-bold text-[#f87171] uppercase tracking-wider block mb-1">Invalidating</span>
            <p className="text-slate-400 leading-relaxed">{thesis.invalidating}</p>
          </div>
        </div>
        <div>
          <span className="text-[9px] font-bold text-[#58a6ff] uppercase tracking-wider block mb-1">Rebalancing Policy</span>
          <p className="text-[11px] text-slate-400 leading-relaxed">{thesis.rebalancing}</p>
        </div>
      </div>

      <div className="terminal-card p-4 rounded-sm">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Methodology &amp; Data Sources</h3>
        <p className="text-[11px] text-slate-400 leading-relaxed">{thesis.methodology}</p>
      </div>

      <div className="bg-orange-950/20 border border-orange-900/50 p-3 rounded text-[10px] text-orange-200 leading-relaxed">
        <strong>Educational tool.</strong> Expected returns, volatilities and correlations are long-run modelling assumptions, not forecasts. This is not investment advice — verify any allocation against your own research before acting on it.
      </div>
    </div>
  );
}
