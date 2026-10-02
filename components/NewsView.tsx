'use client';

import React, { useEffect, useState } from 'react';
import { Newspaper, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { fetchNews, NewsItem } from '../utils/api';
import { RiskProfile } from '../lib/quiz';

function relativeTime(pubDate: string): string {
  const t = new Date(pubDate).getTime();
  if (!t || Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NewsList({ items }: { items: NewsItem[] }) {
  if (items.length === 0) return <p className="text-xs text-slate-400 text-center py-6 uppercase font-mono">No headlines found.</p>;
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <a
          key={`${item.link}-${i}`} href={item.link} target="_blank" rel="noopener noreferrer"
          className="block bg-[#090d13] p-3 border border-[#252e38] rounded-sm hover:border-[#58a6ff] transition-all group"
        >
          <div className="flex justify-between items-start gap-3">
            <p className="text-xs font-bold text-white leading-snug group-hover:text-[#58a6ff]">{item.title}</p>
            <ExternalLink size={12} className="text-slate-400 shrink-0 mt-0.5" />
          </div>
          {item.description && <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{item.description}</p>}
          <div className="flex items-center gap-2 mt-2 text-[9px] text-slate-400 uppercase font-mono">
            <span className="font-bold">{item.source}</span>
            {item.pubDate && <><span>·</span><span>{relativeTime(item.pubDate)}</span></>}
          </div>
        </a>
      ))}
    </div>
  );
}

export default function NewsView({ profile }: { profile: RiskProfile | null }) {
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const holdingTickers = Array.from(new Set(
    (profile?.allocation.holdings || []).map(h => h.ticker).filter(t => t !== 'Cash'),
  )).slice(0, 8);

  const load = async (symbol: string | null) => {
    setLoading(true); setError(null);
    try { setItems(await fetchNews(symbol || undefined)); }
    catch (err: any) { setError(err.message || 'Could not load news'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(activeSymbol); }, [activeSymbol]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = searchInput.trim().toUpperCase();
    if (sym) setActiveSymbol(sym);
  };

  return (
    <div className="space-y-6">
      <div className="terminal-card p-4 rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2"><Newspaper size={16} className="text-[#58a6ff]" /> Market News Wire</h2>
          <p className="text-[10px] text-slate-400 uppercase mt-0.5">Live headlines — Yahoo Finance RSS, no API key</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
          <input
            type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search ticker (e.g. NVDA)"
            className="w-full md:w-56 bg-[#090d13] border border-[#252e38] text-white px-3 py-2 uppercase font-mono text-xs focus:outline-none focus:border-[#58a6ff] rounded-sm"
          />
          <button type="submit" className="bg-[#21262d] border border-[#252e38] hover:bg-[#30363d] text-white px-4 py-2 font-bold text-[10px] uppercase rounded-sm flex items-center gap-2">
            {loading ? <RefreshCw size={12} className="animate-spin" /> : 'Go'}
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveSymbol(null)}
          className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm border ${activeSymbol === null ? 'bg-[#21262d] border-[#58a6ff] text-[#58a6ff]' : 'bg-[#090d13] border-[#252e38] text-slate-400 hover:text-white'}`}
        >
          Market
        </button>
        {holdingTickers.map((t) => (
          <button
            key={t} onClick={() => setActiveSymbol(t)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm border ${activeSymbol === t ? 'bg-[#21262d] border-[#58a6ff] text-[#58a6ff]' : 'bg-[#090d13] border-[#252e38] text-slate-400 hover:text-white'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="terminal-card p-4 rounded-sm">
        <div className="flex justify-between items-center border-b border-[#252e38] pb-2 mb-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest">{activeSymbol ? `${activeSymbol} Headlines` : 'Market Headlines'}</h3>
          <button onClick={() => load(activeSymbol)} className="text-slate-400 hover:text-white" aria-label="Refresh"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
        {error && <div className="bg-red-950/40 border border-red-900 text-[#f87171] p-3 rounded text-xs flex items-center gap-2 mb-3"><AlertTriangle size={14} /> {error}</div>}
        {loading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-16 bg-[#090d13] border border-[#252e38] rounded-sm animate-pulse" />)}</div>
        ) : (
          <NewsList items={items} />
        )}
      </div>
    </div>
  );
}
