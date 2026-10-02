'use client';

import React, { useState } from 'react';
import { ShieldAlert, Layers } from 'lucide-react';
import { QUIZ_QUESTIONS, scoreToProfile, computeAllocation, deriveScores, RiskProfile } from '../lib/quiz';
import { STOCK_UNIVERSE, applyStockPicks } from '../lib/stocks';
import StockSwipeDeck from './StockSwipeDeck';

type Phase = 'quiz' | 'count' | 'swipe';

export default function RiskQuiz({ userEmail, onComplete }: { userEmail: string; onComplete: (profile: RiskProfile) => void }) {
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('quiz');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [vehicle, setVehicle] = useState<string | null>(null);
  const [sectorPrefs, setSectorPrefs] = useState<string[]>([]);
  const [downtrendStyle, setDowntrendStyle] = useState<string | null>(null);
  const [multiSelection, setMultiSelection] = useState<string[]>([]);
  const [stockCount, setStockCount] = useState(6);

  const finish = (
    finalAnswers: Record<string, number>, finalVehicle: string | null, finalSectors: string[],
    finalStyle: string | null, selectedStocks: string[] = [],
  ) => {
    const { score } = deriveScores(finalAnswers);
    const { bucket, blurb } = scoreToProfile(score);
    let allocation = computeAllocation(score, finalVehicle || 'mix', finalSectors, finalAnswers, finalStyle);
    if (selectedStocks.length) allocation = applyStockPicks(allocation, selectedStocks);
    onComplete({
      score, bucket, blurb, answers: finalAnswers, vehicle: finalVehicle || 'mix', sectors: finalSectors,
      downtrendStyle: finalStyle, allocation, selectedStocks, generated_at: new Date().toISOString()
    });
  };

  const advance = (extra: { answers?: Record<string, number>; vehicle?: string; sectors?: string[]; style?: string }) => {
    if (step < QUIZ_QUESTIONS.length - 1) { setStep(step + 1); setMultiSelection([]); return; }
    const finalAnswers = extra.answers !== undefined ? extra.answers : answers;
    const finalVehicle = extra.vehicle !== undefined ? extra.vehicle : vehicle;
    const finalSectors = extra.sectors !== undefined ? extra.sectors : sectorPrefs;
    const finalStyle = extra.style !== undefined ? extra.style : downtrendStyle;

    // ETF-only / mutual-fund portfolios don't carry individual-stock picks, and there's
    // nothing to swipe through if none of the active sectors have any candidate stocks
    const hasCandidates = finalVehicle !== 'etf' && finalVehicle !== 'mutual' && (() => {
      const { score } = deriveScores(finalAnswers);
      const prelim = computeAllocation(score, finalVehicle || 'mix', finalSectors, finalAnswers, finalStyle);
      const activeSleeves = new Set(prelim.categories.map(c => c.category));
      return STOCK_UNIVERSE.some(s => activeSleeves.has(s.sleeve));
    })();

    if (!hasCandidates) { finish(finalAnswers, finalVehicle, finalSectors, finalStyle); return; }

    setAnswers(finalAnswers); setVehicle(finalVehicle); setSectorPrefs(finalSectors); setDowntrendStyle(finalStyle);
    setPhase('count');
  };

  const q = QUIZ_QUESTIONS[step];
  const handleScoreAnswer = (points: number) => { const next = { ...answers, [q.id]: points }; setAnswers(next); advance({ answers: next }); };
  const handleVehicleAnswer = (value: string) => { setVehicle(value); advance({ vehicle: value }); };
  const handleStyleAnswer = (value: string) => { setDowntrendStyle(value); advance({ style: value }); };
  const toggleMulti = (value: string, max: number) => {
    if (value === 'none') { setMultiSelection(['none']); return; }
    setMultiSelection(prev => {
      const withoutNone = prev.filter(v => v !== 'none');
      if (withoutNone.includes(value)) return withoutNone.filter(v => v !== value);
      if (withoutNone.length >= max) return withoutNone;
      return [...withoutNone, value];
    });
  };
  const submitMulti = () => { setSectorPrefs(multiSelection); advance({ sectors: multiSelection }); };

  if (phase === 'count' || phase === 'swipe') {
    const { score } = deriveScores(answers);
    const prelim = computeAllocation(score, vehicle || 'mix', sectorPrefs, answers, downtrendStyle);
    const activeSleeves = new Set(prelim.categories.map(c => c.category));
    const candidates = STOCK_UNIVERSE.filter(s => activeSleeves.has(s.sleeve));

    return (
      <div className="h-screen bg-[#090d13] flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-[#121820] border border-[#252e38] p-6 rounded-sm shadow-xl space-y-6">
          <div className="text-center border-b border-[#252e38] pb-4">
            <Layers className="w-8 h-8 text-[#58a6ff] mx-auto mb-2" />
            <h1 className="text-sm font-bold text-white uppercase tracking-widest">{phase === 'count' ? 'Pick Individual Stocks?' : 'Swipe To Build Your Picks'}</h1>
            <p className="text-[9px] text-slate-400 uppercase mt-1">
              {phase === 'count' ? 'Optional — every sector already gets an ETF automatically' : `From sectors your profile is already weighted toward`}
            </p>
          </div>

          {phase === 'count' && (
            <div className="space-y-5">
              <p className="text-xs text-slate-300 leading-relaxed">
                Every sector in your portfolio already gets an ETF for broad coverage. On top of that, you can hand-pick a
                few individual stocks by swiping through cards — they'll take half the weight of their sector, split evenly.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase">Stocks to pick</span>
                  <span className="text-white font-bold">{stockCount === 0 ? 'None — skip' : stockCount}</span>
                </div>
                <input
                  type="range" min={0} max={Math.min(20, candidates.length)} step={1} value={stockCount}
                  onChange={(e) => setStockCount(parseInt(e.target.value, 10))}
                  className="w-full accent-[#58a6ff]"
                />
              </div>
              <button
                onClick={() => (stockCount === 0 ? finish(answers, vehicle, sectorPrefs, downtrendStyle) : setPhase('swipe'))}
                className="w-full bg-[#21262d] border border-[#58a6ff] text-[#58a6ff] font-bold px-3 py-2.5 text-xs rounded-sm uppercase"
              >
                {stockCount === 0 ? 'Skip — Finish Setup' : 'Start Swiping'}
              </button>
            </div>
          )}

          {phase === 'swipe' && (
            <StockSwipeDeck
              candidates={candidates}
              targetCount={stockCount}
              onDone={(selected) => finish(answers, vehicle, sectorPrefs, downtrendStyle, selected)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#090d13] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-[#121820] border border-[#252e38] p-6 rounded-sm shadow-xl space-y-6">
        <div className="text-center border-b border-[#252e38] pb-4">
          <ShieldAlert className="w-8 h-8 text-[#58a6ff] mx-auto mb-2" />
          <h1 className="text-sm font-bold text-white uppercase tracking-widest">Risk Profile Setup</h1>
          <p className="text-[9px] text-slate-400 uppercase mt-1">Welcome, {userEmail} — {QUIZ_QUESTIONS.length} quick questions to build your portfolio</p>
        </div>
        <div className="w-full h-1 bg-[#21262d] rounded-full overflow-hidden">
          <div className="h-full bg-[#58a6ff] transition-all" style={{ width: `${((step + 1) / QUIZ_QUESTIONS.length) * 100}%` }} />
        </div>
        <div className="space-y-3">
          <p className="text-[9px] text-slate-400 uppercase font-bold">Question {step + 1} of {QUIZ_QUESTIONS.length}</p>
          <p className="text-sm text-white font-bold">{q.text}</p>

          {q.type === 'score' && (
            <div className="space-y-2">
              {q.options.map(opt => (
                <button key={opt.label} onClick={() => handleScoreAnswer(opt.points)} className="w-full text-left bg-[#21262d] border border-[#252e38] hover:bg-[#30363d] text-white px-3 py-2.5 text-xs rounded-sm">{opt.label}</button>
              ))}
            </div>
          )}
          {q.type === 'single-pref' && q.id === 'vehicle' && (
            <div className="space-y-2">
              {q.options.map(opt => (
                <button key={opt.label} onClick={() => handleVehicleAnswer(opt.value)} className="w-full text-left bg-[#21262d] border border-[#252e38] hover:bg-[#30363d] text-white px-3 py-2.5 text-xs rounded-sm">{opt.label}</button>
              ))}
            </div>
          )}
          {q.type === 'single-pref' && q.id === 'downtrend_style' && (
            <div className="space-y-2">
              {q.options.map(opt => (
                <button key={opt.label} onClick={() => handleStyleAnswer(opt.value)} className="w-full text-left bg-[#21262d] border border-[#252e38] hover:bg-[#30363d] text-white px-3 py-2.5 text-xs rounded-sm">{opt.label}</button>
              ))}
            </div>
          )}
          {q.type === 'multi-pref' && (
            <div className="space-y-3">
              <div className="space-y-2">
                {q.options.map(opt => {
                  const selected = multiSelection.includes(opt.value);
                  return (
                    <button
                      key={opt.label}
                      onClick={() => toggleMulti(opt.value, (q as any).max)}
                      className={`w-full text-left px-3 py-2.5 text-xs rounded-sm border ${selected ? 'bg-[#21262d] border-[#58a6ff] text-[#58a6ff] font-bold' : 'bg-[#21262d] border-[#252e38] text-white hover:bg-[#30363d]'}`}
                    >
                      {selected ? '✓ ' : ''}{opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-slate-400 uppercase">Up to {(q as any).max} — optional</p>
              <button onClick={submitMulti} className="w-full bg-[#21262d] border border-[#58a6ff] text-[#58a6ff] font-bold px-3 py-2.5 text-xs rounded-sm uppercase">Continue</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
