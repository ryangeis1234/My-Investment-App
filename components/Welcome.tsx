'use client';

import React, { useState } from 'react';
import { Database, ShieldAlert, Sparkles, Briefcase, SlidersHorizontal, ChevronRight } from 'lucide-react';

const SLIDES = [
  {
    icon: Database,
    title: 'Welcome to Strategy Lab',
    body: "A research console that builds a portfolio around your risk tolerance and explains why. Nothing here is investment advice — it's a place to learn and experiment.",
  },
  {
    icon: ShieldAlert,
    title: 'Start with the Risk Quiz',
    body: "A dozen quick questions about your time horizon and how you'd react to a drawdown. From there you'll optionally hand-pick a few individual stocks by swiping through cards.",
  },
  {
    icon: Briefcase,
    title: 'Portfolio & Dashboard',
    body: 'See the target allocation, expected return, volatility and drawdown the engine computed, plus a projected-value chart and where your portfolio sits on the risk/return frontier.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Model It',
    body: 'On the Portfolio page, slide the risk factors yourself and watch the allocation and stats recompute live — each stat tells you what would move it up or down.',
  },
  {
    icon: Sparkles,
    title: 'Thesis Builder',
    body: 'Turns your portfolio into a written, numbers-backed investment thesis — objective, risks, and rules for when to reconsider — which you can save to the Thesis Tracker.',
  },
];

export default function Welcome({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const Icon = slide.icon;
  const last = step === SLIDES.length - 1;

  return (
    <div className="h-screen bg-[#090d13] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#121820] border border-[#252e38] p-6 rounded-sm shadow-xl space-y-6">
        <div className="flex justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-6 bg-[#58a6ff]' : 'w-1.5 bg-[#252e38]'}`} />
          ))}
        </div>
        <div className="text-center space-y-3">
          <Icon className="w-10 h-10 text-[#58a6ff] mx-auto" />
          <h1 className="text-sm font-bold text-white uppercase tracking-widest">{slide.title}</h1>
          <p className="text-xs text-slate-400 leading-relaxed">{slide.body}</p>
        </div>
        <div className="flex gap-2">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="flex-1 bg-[#090d13] border border-[#252e38] text-slate-400 py-2.5 text-[10px] font-bold uppercase rounded-sm">
              Back
            </button>
          )}
          <button onClick={() => onDone()} className="flex-1 bg-[#090d13] border border-[#252e38] text-slate-400 py-2.5 text-[10px] font-bold uppercase rounded-sm">
            Skip
          </button>
          <button
            onClick={() => (last ? onDone() : setStep((s) => s + 1))}
            className="flex-[2] bg-[#21262d] border border-[#58a6ff] text-[#58a6ff] py-2.5 text-[10px] font-bold uppercase rounded-sm flex items-center justify-center gap-1.5"
          >
            {last ? 'Get Started' : 'Next'} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
