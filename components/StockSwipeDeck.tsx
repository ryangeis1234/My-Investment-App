'use client';

import React, { useRef, useState } from 'react';
import { X, Heart, RotateCcw } from 'lucide-react';
import { StockCard } from '../lib/stocks';

const SWIPE_THRESHOLD = 90;

export default function StockSwipeDeck({
  candidates, targetCount, onDone,
}: { candidates: StockCard[]; targetCount: number; onDone: (selected: string[]) => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [drag, setDrag] = useState<{ x: number; startX: number; dragging: boolean }>({ x: 0, startX: 0, dragging: false });
  const cardRef = useRef<HTMLDivElement>(null);

  const done = selected.length >= targetCount || index >= candidates.length;
  const current = candidates[index];

  const commit = (add: boolean) => {
    if (!current) return;
    setSelected((prev) => (add ? [...prev, current.ticker] : prev));
    setDrag({ x: 0, startX: 0, dragging: false });
    setIndex((i) => i + 1);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ x: 0, startX: e.clientX, dragging: true });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.dragging) return;
    setDrag((d) => ({ ...d, x: e.clientX - d.startX }));
  };
  const onPointerUp = () => {
    if (!drag.dragging) return;
    if (drag.x > SWIPE_THRESHOLD) commit(true);
    else if (drag.x < -SWIPE_THRESHOLD) commit(false);
    else setDrag({ x: 0, startX: 0, dragging: false });
  };

  if (done) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-white font-bold">
          {selected.length > 0 ? `${selected.length} stock${selected.length === 1 ? '' : 's'} selected` : 'No individual stocks selected'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {selected.map((t) => (
            <span key={t} className="px-2 py-1 bg-[#21262d] border border-[#30363d] rounded-sm text-xs font-bold text-[#58a6ff]">{t}</span>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 uppercase">Sector ETFs cover the rest of each sleeve automatically.</p>
        <button onClick={() => onDone(selected)} className="w-full bg-[#21262d] border border-[#58a6ff] text-[#58a6ff] font-bold px-3 py-2.5 text-xs rounded-sm uppercase">
          Continue
        </button>
      </div>
    );
  }

  const rot = drag.x / 18;
  const likeOpacity = Math.max(0, Math.min(1, drag.x / SWIPE_THRESHOLD));
  const skipOpacity = Math.max(0, Math.min(1, -drag.x / SWIPE_THRESHOLD));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-[9px] text-slate-400 uppercase font-bold">
        <span>{selected.length} of {targetCount} picked</span>
        <span>{candidates.length - index} left</span>
      </div>
      <div className="relative h-56">
        {candidates[index + 1] && (
          <div className="absolute inset-0 bg-[#161b22] border border-[#252e38] rounded-sm scale-[0.96] translate-y-2" />
        )}
        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ transform: `translateX(${drag.x}px) rotate(${rot}deg)`, transition: drag.dragging ? 'none' : 'transform 0.2s ease' }}
          className="absolute inset-0 bg-[#121820] border border-[#252e38] rounded-sm p-5 flex flex-col justify-between cursor-grab active:cursor-grabbing select-none touch-none"
        >
          <div className="absolute top-4 left-4 text-[#4ade80] font-bold text-sm uppercase border-2 border-[#4ade80] rounded px-2 py-0.5 -rotate-12" style={{ opacity: likeOpacity }}>Add</div>
          <div className="absolute top-4 right-4 text-[#f87171] font-bold text-sm uppercase border-2 border-[#f87171] rounded px-2 py-0.5 rotate-12" style={{ opacity: skipOpacity }}>Skip</div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase font-bold block">{current.sleeve}</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-white">{current.ticker}</span>
              <span className="text-xs text-slate-400">{current.name}</span>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{current.blurb}</p>
        </div>
      </div>
      <div className="flex justify-center gap-4">
        <button onClick={() => commit(false)} aria-label="Skip" className="w-12 h-12 rounded-full bg-[#090d13] border border-red-900 text-[#f87171] flex items-center justify-center hover:bg-red-950/40">
          <X size={20} />
        </button>
        {selected.length > 0 && (
          <button onClick={() => onDone(selected)} aria-label="Finish early" className="px-3 h-12 rounded-full bg-[#090d13] border border-[#252e38] text-slate-400 text-[10px] font-bold uppercase flex items-center gap-1.5 hover:text-white">
            <RotateCcw size={14} /> I have enough
          </button>
        )}
        <button onClick={() => commit(true)} aria-label="Add" className="w-12 h-12 rounded-full bg-[#090d13] border border-green-900 text-[#4ade80] flex items-center justify-center hover:bg-green-950/40">
          <Heart size={20} />
        </button>
      </div>
    </div>
  );
}
