'use client';

import React, { useState, useEffect, startTransition } from 'react';
import { useAuth } from '../context/AuthContext';
import { dbService, fetchStockData, fetchNews, StockData, Watchlist, WatchlistItem, Thesis, NewsItem } from '../utils/api';
import { RiskProfile } from '../lib/quiz';
import RiskQuiz from '../components/RiskQuiz';
import PortfolioView from '../components/PortfolioView';
import SettingsView from '../components/SettingsView';
import ThesisBuilder from '../components/ThesisBuilder';
import Welcome from '../components/Welcome';
import NewsView, { NewsList } from '../components/NewsView';
import {
  LayoutDashboard, Search, FileText, Briefcase, Bookmark, Settings,
  ChevronRight, Database, X, Menu, Key, TrendingUp, Newspaper,
  DollarSign, ShieldAlert, Activity, Layers, Sparkles, RefreshCw, Plus, Trash, AlertTriangle, Edit3
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Home() {
  const { user, loading, signIn, signOut, isMock } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [balance, setBalanceState] = useState(100000);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!user) { setProfileLoading(false); return; }
    let cancelled = false;
    setProfileLoading(true);
    dbService.getRiskProfile()
      .then(p => { if (!cancelled) setRiskProfile(p); })
      .catch(() => { if (!cancelled) setRiskProfile(null); })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    dbService.getBalance().then(b => { if (!cancelled) setBalanceState(b); }).catch(() => {});
    if (typeof window !== 'undefined' && !localStorage.getItem('sl_seen_welcome')) setShowWelcome(true);
    return () => { cancelled = true; };
  }, [user]);

  const handleBalanceChange = async (amount: number) => {
    const saved = await dbService.saveBalance(amount);
    setBalanceState(saved);
  };
  const handleWelcomeDone = () => {
    if (typeof window !== 'undefined') localStorage.setItem('sl_seen_welcome', '1');
    setShowWelcome(false);
  };

  const handleQuizComplete = async (profile: RiskProfile) => {
    setRiskProfile(profile);
    try { await dbService.saveRiskProfile(profile); } catch (err) { console.error('Failed to save risk profile', err); }
  };
  const handleRetakeQuiz = async () => {
    setRiskProfile(null);
    try { await dbService.deleteRiskProfile(); } catch (err) { console.error('Failed to clear risk profile', err); }
  };
  const handleResetAllData = async () => {
    try {
      const lists = await dbService.getWatchlists();
      for (const l of lists) await dbService.deleteWatchlist(l.id);
      const theses = await dbService.getTheses();
      for (const t of theses) await dbService.deleteThesis(t.id);
      await dbService.deleteRiskProfile();
    } catch (err) { console.error('Failed to reset data', err); }
    setRiskProfile(null);
    signOut();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setAuthLoading(true);
    try { await signIn(emailInput); } catch (err: any) { alert(err.message || 'Login Error'); } finally { setAuthLoading(false); }
  };

  const renderActivePage = () => {
    switch(currentPage) {
      case 'dashboard': return <DashboardOverview profile={riskProfile} balance={balance} onNavigate={setCurrentPage} />;
      case 'stock-research': return <StockResearchView />;
      case 'news': return <NewsView profile={riskProfile} />;
      case 'watchlist': return <WatchlistView />;
      case 'thesis-tracker': return <ThesisTrackerView />;
      case 'thesis-builder': return <ThesisBuilder profile={riskProfile} onRetake={handleRetakeQuiz} />;
      case 'portfolio': return (
        <PortfolioView
          profile={riskProfile} balance={balance} onRetake={handleRetakeQuiz}
          onBalanceChange={handleBalanceChange} onProfileChange={handleQuizComplete}
        />
      );
      case 'settings': return <SettingsView userEmail={user?.email || ''} riskProfile={riskProfile} onRetake={handleRetakeQuiz} onSignOut={signOut} onResetData={handleResetAllData} />;
      default:
        return (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-[#121820] rounded border border-[#252e38] max-w-xl mx-auto my-12">
            <Settings className="w-12 h-12 text-[#58a6ff] mb-4 animate-spin" />
            <p className="text-sm font-bold text-white uppercase tracking-wider mb-2">{currentPage.replace('-', ' ')} Page</p>
            <p className="text-xs text-slate-400">This page isn't available yet.</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#090d13] flex items-center justify-center font-mono">
        <div className="text-center space-y-3">
          <div className="w-6 h-6 border-2 border-highlight border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Establishing Secure Data Link...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen bg-[#090d13] flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-[#121820] border border-[#252e38] p-6 rounded-sm shadow-xl space-y-6">
          <div className="text-center border-b border-[#252e38] pb-4">
            <Key className="w-8 h-8 text-[#58a6ff] mx-auto mb-2" />
            <h1 className="text-sm font-bold text-white uppercase tracking-widest">STRATEGY_LAB_AUTH</h1>
            <p className="text-[9px] text-slate-400 uppercase mt-1">Research & Analytics Login Portal</p>
          </div>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Enter email address</label>
              <input
                id="auth-email" type="email" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="analyst@strategylab.com"
                className="w-full bg-[#090d13] border border-[#252e38] text-white px-3 py-2 text-xs focus:outline-none focus:border-[#58a6ff] rounded-sm font-mono"
              />
            </div>
            <button type="submit" disabled={authLoading} className="w-full bg-[#21262d] border border-[#252e38] hover:bg-[#30363d] text-white py-2 text-[10px] font-bold tracking-widest uppercase transition-all rounded-sm flex justify-center items-center gap-2">
              {authLoading ? 'ESTABLISHING...' : 'AUTHENTICATE SESSION'}
            </button>
          </form>
          {isMock && (
            <button
              type="button" disabled={authLoading}
              onClick={async () => { setAuthLoading(true); try { await signIn('demo@strategylab.app'); } finally { setAuthLoading(false); } }}
              className="w-full bg-[#090d13] border border-[#58a6ff] hover:bg-[#161b22] text-[#58a6ff] py-2 text-[10px] font-bold tracking-widest uppercase transition-all rounded-sm flex justify-center items-center gap-2"
            >
              <Sparkles size={12} /> Try the demo — no email needed
            </button>
          )}
          {isMock && (
            <div className="bg-blue-950/20 border border-blue-900/50 p-2.5 rounded text-[10px] leading-relaxed text-blue-200 font-mono">
              <strong>LOCAL DEMO MODE:</strong> No account server is connected, so sign-in is simulated and your data stays in this browser. Any email works, or use the demo button.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="h-screen bg-[#090d13] flex items-center justify-center font-mono">
        <div className="text-center space-y-3">
          <div className="w-6 h-6 border-2 border-highlight border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Loading Risk Profile...</p>
        </div>
      </div>
    );
  }

  if (showWelcome) {
    return <Welcome onDone={handleWelcomeDone} />;
  }

  if (!riskProfile) {
    return <RiskQuiz userEmail={user.email || ''} onComplete={handleQuizComplete} />;
  }

  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'stock-research', name: 'Stock Research', icon: Search },
    { id: 'news', name: 'News', icon: Newspaper },
    { id: 'thesis-tracker', name: 'Thesis Tracker', icon: FileText },
    { id: 'watchlist', name: 'Watchlist', icon: Bookmark },
    { id: 'thesis-builder', name: 'Thesis Builder', icon: Sparkles },
    { id: 'portfolio', name: 'Portfolio', icon: Briefcase },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#090d13] text-[#c9d1d9] overflow-hidden">
      <aside className={`fixed inset-y-0 left-0 z-50 bg-[#121820] border-r border-[#252e38] flex flex-col justify-between transition-all duration-300 transform lg:translate-x-0 lg:static ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'} ${isCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="flex flex-col flex-grow">
          <div className="h-16 flex items-center justify-between px-4 border-b border-[#252e38]">
            {(!isCollapsed || isOpenMobile) ? (
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#58a6ff]" />
                <span className="font-bold text-white text-sm tracking-widest">STRATEGY LAB</span>
              </div>
            ) : (
              <Database className="w-5 h-5 text-[#58a6ff] mx-auto" />
            )}
            <button onClick={() => setIsOpenMobile(false)} className="lg:hidden p-1 hover:bg-[#21262d] rounded text-gray-400 hover:text-white" aria-label="Close menu">
              <X size={18} />
            </button>
          </div>
          <nav className="p-3 space-y-1.5 flex-grow">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button key={item.id} onClick={() => { setCurrentPage(item.id); setIsOpenMobile(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all text-left focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-none ${isActive ? 'bg-[#21262d] text-[#58a6ff] border-l-2 border-[#58a6ff]' : 'text-slate-300 hover:text-white hover:bg-[#161b22]'}`}>
                  <Icon size={18} className={isActive ? 'text-[#58a6ff]' : 'text-slate-400'} />
                  {(!isCollapsed || isOpenMobile) && <span className="text-xs font-bold tracking-wide">{item.name}</span>}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="p-3 border-t border-[#252e38] bg-[#0d1117]/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#4ade80]" />
            {(!isCollapsed || isOpenMobile) && <span className="text-[10px] text-white font-bold font-mono">{isMock ? 'LOCAL DEMO MODE' : 'CONNECTED'}</span>}
          </div>
          {(!isCollapsed || isOpenMobile) && (
            <button onClick={() => signOut()} className="text-[8px] bg-red-950 text-red-200 border border-red-900 px-1 py-0.5 rounded font-bold hover:bg-red-900 hover:text-white transition-all font-mono">LOGOUT</button>
          )}
        </div>
      </aside>

      <div className="flex flex-col flex-grow overflow-hidden">
        <header className="h-16 bg-[#121820] border-b border-[#252e38] flex items-center justify-between px-4 sm:px-6 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsOpenMobile(true)} className="lg:hidden p-1.5 hover:bg-[#21262d] rounded border border-[#252e38] text-gray-400 hover:text-white" aria-label="Open menu">
              <Menu size={18} />
            </button>
            <span className="text-xs font-bold text-slate-400 tracking-wider hidden xs:block">WORKSPACE:</span>
            <span className="text-[10px] sm:text-xs font-bold text-white px-2 py-0.5 bg-[#21262d] border border-[#30363d] rounded-sm uppercase tracking-widest">{currentPage.replace('-', ' ')}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-slate-400 block font-bold">ANALYST SESSION</span>
              <span className="font-bold text-[#58a6ff]">{user.email}</span>
            </div>
            <div className="w-8 h-8 rounded bg-[#21262d] border border-[#30363d] flex items-center justify-center font-bold text-white text-xs">{(user.email || '?').charAt(0).toUpperCase()}</div>
          </div>
        </header>

        <main className="flex-grow p-4 sm:p-6 overflow-y-auto">
          {renderActivePage()}
          <footer className="mt-8 pt-4 border-t border-[#252e38] text-center text-slate-400 text-[9px] leading-relaxed">
            This Strategy Lab software is for research and educational purposes only. It does not offer customized financial advisory solutions, nor does it connect to dynamic trading broker systems.
          </footer>
        </main>
      </div>
    </div>
  );
}

/* SUB-VIEW 1.0: DASHBOARD OVERVIEW */
const HORIZON_YEARS: Record<number, number> = { 0: 1, 1: 2, 2: 5, 3: 10, 4: 20 };
const SLEEVE_COLORS = ['#58a6ff', '#4ade80', '#fb923c', '#a78bfa', '#f87171', '#22d3ee', '#facc15', '#f472b6', '#94a3b8', '#34d399', '#fdba74'];

function buildProjection(balance: number, mu: number, vol: number, years: number) {
  const pts = [];
  const steps = Math.max(6, Math.round(years * 4)); // quarterly
  const drift = mu - 0.5 * vol * vol;
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * years;
    const sd = vol * Math.sqrt(y);
    const lower = Math.round(balance * Math.exp(drift * y - sd));
    const upper = Math.round(balance * Math.exp(drift * y + sd));
    pts.push({
      t: y < 1 ? `${Math.round(y * 12)}m` : `${y.toFixed(1)}y`,
      median: Math.round(balance * Math.exp(drift * y)),
      lower,
      band: upper - lower, // stacked on top of `lower` to draw the ±1σ ribbon
    });
  }
  return pts;
}

function DashboardOverview({ profile, balance, onNavigate }: { profile: RiskProfile | null; balance: number; onNavigate: (p: string) => void }) {
  if (!profile) return null;
  const a = profile.allocation;
  const st = a.stats;
  const years = HORIZON_YEARS[profile.answers.horizon ?? 2] ?? 5;
  const projection = buildProjection(balance, st.expReturn, st.volatility, years);
  const catData = [...a.categories].sort((x, y) => y.weight - x.weight);
  const pctStr = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

  const kpis = [
    { label: 'Account Balance', value: `$${balance.toLocaleString('en', { maximumFractionDigits: 0 })}`, icon: DollarSign, color: '#58a6ff' },
    { label: 'Expected Return', value: `${pctStr(st.expReturn)} / yr`, icon: TrendingUp, color: '#4ade80' },
    { label: 'Target Volatility', value: `${pctStr(a.targetVol)} (real ${pctStr(a.achievedVol)})`, icon: Activity, color: '#fb923c' },
    { label: 'Severe Drawdown', value: `-${pctStr(st.severeDrawdown)}`, icon: ShieldAlert, color: '#f87171' },
  ];
  const stats2 = [
    { label: 'Sharpe Ratio', value: st.sharpe.toFixed(2) },
    { label: 'Portfolio Beta', value: `${st.beta.toFixed(2)} x mkt` },
    { label: 'Income Yield', value: pctStr(st.yield) },
    { label: '1-yr 95% VaR', value: `-${pctStr(st.var95)}` },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2"><LayoutDashboard size={16} className="text-[#58a6ff]" /> {profile.bucket} Portfolio — Live Model</h2>
          <p className="text-[10px] text-slate-400 uppercase mt-0.5">Risk score {profile.score}/100 · {a.holdings.length} holdings · vehicle {profile.vehicle}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNavigate('thesis-builder')} className="bg-[#21262d] border border-[#252e38] hover:bg-[#30363d] text-white px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm flex items-center gap-1.5"><Sparkles size={12} className="text-[#58a6ff]" /> Build Thesis</button>
          <button onClick={() => onNavigate('portfolio')} className="bg-[#21262d] border border-[#252e38] hover:bg-[#30363d] text-white px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm flex items-center gap-1.5"><Briefcase size={12} className="text-[#58a6ff]" /> Full Portfolio</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-[#121820] p-4 border border-[#252e38] rounded flex justify-between items-start">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">{k.label}</span>
                <span className="text-base font-bold text-white block mt-1" style={{ color: k.color }}>{k.value}</span>
              </div>
              <div className="p-2 bg-[#21262d] rounded border border-[#30363d]" style={{ color: k.color }}><Icon size={16} /></div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#121820] p-3 border border-[#252e38] rounded text-xs">
        {stats2.map((s, i) => (
          <div key={s.label} className={`pr-2 ${i < stats2.length - 1 ? 'border-r border-[#252e38]' : ''}`}>
            <span className="text-slate-400 text-[9px] uppercase font-bold">{s.label}</span>
            <p className="font-bold text-white mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#121820] p-4 border border-[#252e38] rounded">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5 mb-4"><Layers size={14} className="text-[#58a6ff]" /> Projected Value — {years}-yr Horizon (median &amp; ±1σ band)</h3>
          <div className="relative w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projection} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.22}/>
                    <stop offset="95%" stopColor="#58a6ff" stopOpacity={0.04}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" stroke="#8b949e" tick={{ fontSize: 9 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis stroke="#8b949e" tick={{ fontSize: 9 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={48} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#121820', borderColor: '#252e38', fontSize: 11, color: '#c9d1d9' }}
                  formatter={(v: number, name) => [`$${Number(v).toLocaleString()}`, name === 'band' ? '±1σ width' : name === 'lower' ? 'Lower 1σ' : 'Median']}
                />
                <Area type="monotone" dataKey="lower" stackId="cone" stroke="none" fill="transparent" isAnimationActive={false} />
                <Area type="monotone" dataKey="band" stackId="cone" stroke="none" fill="url(#bandGrad)" isAnimationActive={false} />
                <Area type="monotone" dataKey="median" stroke="#58a6ff" fill="none" strokeWidth={1.8} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#121820] p-4 border border-[#252e38] rounded">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5 mb-4"><Layers size={14} className="text-[#58a6ff]" /> Sleeve Allocation</h3>
          <div className="w-full" style={{ height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="weight" nameKey="category" isAnimationActive={false}>
                  {catData.map((entry, index) => <Cell key={`cell-${index}`} fill={SLEEVE_COLORS[index % SLEEVE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#121820', borderColor: '#252e38', fontSize: 11, color: '#c9d1d9' }} formatter={(v: number) => `${v.toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[9px] uppercase font-mono mt-2">
            {catData.map((item, idx) => (
              <div key={item.category} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SLEEVE_COLORS[idx % SLEEVE_COLORS.length] }} />
                <span className="text-slate-400 font-bold">{item.category} ({item.weight.toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#121820] p-4 border border-[#252e38] rounded">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5 mb-3"><Briefcase size={14} className="text-[#58a6ff]" /> Target Holdings</h3>
          <table className="w-full text-left text-xs border-collapse">
            <thead><tr className="border-b border-[#252e38] text-slate-400 font-bold"><th className="pb-2">TICKER</th><th className="pb-2">SLEEVE</th><th className="pb-2 text-right">WEIGHT</th><th className="pb-2 text-right">TARGET $</th></tr></thead>
            <tbody>
              {[...a.holdings].sort((x, y) => y.weight - x.weight).map((h, i) => (
                <tr key={`${h.ticker}-${i}`} className="border-b border-[#252e38]/60">
                  <td className="py-1.5 font-bold text-white">{h.ticker}</td>
                  <td className="py-1.5 text-slate-400">{h.category}</td>
                  <td className="py-1.5 text-right">{h.weight.toFixed(1)}%</td>
                  <td className="py-1.5 text-right">${((h.weight / 100) * balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-[#121820] p-4 border border-[#252e38] rounded">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5 mb-3"><Activity size={14} className="text-[#58a6ff]" /> Risk Factor Read-out</h3>
          <div className="space-y-2.5">
            {[
              { label: 'Time-horizon score', v: profile.allocation.subScores.horizon },
              { label: 'Loss composure', v: profile.allocation.subScores.tolerance },
              { label: 'Risk capacity', v: profile.allocation.subScores.capacity },
              { label: 'Experience', v: profile.allocation.subScores.experience },
              { label: 'Leverage comfort', v: profile.allocation.subScores.leverageComfort },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-[10px] mb-1"><span className="text-slate-400 font-bold uppercase">{r.label}</span><span className="text-white">{Math.round(r.v * 100)}</span></div>
                <div className="w-full h-1.5 bg-[#090d13] rounded-full overflow-hidden border border-[#252e38]"><div className="h-full bg-[#58a6ff]" style={{ width: `${r.v * 100}%` }} /></div>
              </div>
            ))}
            <p className="text-[10px] text-slate-400 pt-1 leading-relaxed">Leveraged + speculative exposure: <span className="text-white font-bold">{pctStr(st.leverageExposure)}</span> of book. {a.rebalancing.rule}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* SUB-VIEW 2.0: STOCK RESEARCH SCREEN */
function StockResearchView() {
  const [ticker, setTicker] = useState('AAPL');
  const [searchVal, setSearchVal] = useState('AAPL');
  const [stock, setStock] = useState<StockData | null>(null);
  const [timeframe, setTimeframe] = useState<'1M' | '6M' | '1Y' | '5Y'>('1Y');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  const handleQuery = async (symbol: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStockData(symbol);
      setStock(data);
      setTicker(data.ticker);
      setNewsLoading(true);
      fetchNews(data.ticker).then(setNews).catch(() => setNews([])).finally(() => setNewsLoading(false));
    } catch (err: any) {
      setError(err.message || 'Error resolving index');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { handleQuery(ticker); }, []);

  return (
    <div className="space-y-6">
      <div className="terminal-card p-4 rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2"><Search size={16} className="text-[#58a6ff]" /> Corporate Analytics Core</h2>
          <p className="text-[10px] text-slate-400 uppercase mt-0.5">Abstract API resolves and builds sector indicators securely</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleQuery(searchVal); }} className="flex gap-2 w-full md:w-auto">
          <input type="text" value={searchVal} onChange={(e) => setSearchVal(e.target.value)} placeholder="TICKER (e.g. LMT, XOM)" className="w-full md:w-64 bg-[#090d13] border border-[#252e38] text-white px-3 py-2 uppercase font-mono text-xs focus:outline-none focus:border-[#58a6ff] rounded-sm" />
          <button type="submit" className="bg-[#21262d] border border-[#252e38] hover:bg-[#30363d] text-white px-4 py-2 font-bold text-[10px] uppercase rounded-sm flex items-center gap-2">{loading ? <RefreshCw size={12} className="animate-spin" /> : <ChevronRight size={12} />} EXECUTE</button>
        </form>
      </div>

      {error && <div className="bg-red-950/40 border border-red-900 text-[#f87171] p-3 rounded text-xs">Error: {error}. Try LMT, XOM, AAPL or MSFT.</div>}
      {loading && <div className="h-44 bg-[#121820] border border-[#252e38] rounded-sm animate-pulse" />}

      {!loading && stock && (
        <div className="space-y-6">
          <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[#58a6ff] font-bold text-xs uppercase bg-[#21262d] border border-[#30363d] px-2 py-0.5 rounded-sm">{stock.ticker}</span>
                <h1 className="text-lg font-bold text-white">{stock.companyName}</h1>
              </div>
              <p className="text-[10px] text-slate-400 uppercase mt-1 flex items-center gap-1.5">
                {stock.liveFields.length > 0 ? (
                  <span className="flex items-center gap-1 text-[#4ade80]"><span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" /> LIVE — Yahoo Finance{stock.exchange ? ` · ${stock.exchange}` : ''}</span>
                ) : (
                  <span className="text-amber-500">Live feed unreachable — showing illustrative data</span>
                )}
              </p>
            </div>
            <div className="flex gap-6 items-center">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold text-right">PRICE</span>
                <span className="text-xl font-bold text-white block mt-0.5">${stock.price.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold text-right">CHANGE</span>
                <span className={`text-sm font-bold flex items-center gap-0.5 mt-1 justify-end ${stock.dailyChange >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>{stock.dailyChange >= 0 ? '+' : ''}{stock.dailyChange.toFixed(2)} ({stock.dailyChangePct}%)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-[#121820] p-3 border border-[#252e38] rounded-sm text-xs"><span className="text-slate-400 font-bold block uppercase text-[9px]">Market Cap</span><p className="font-bold text-white mt-0.5">${stock.marketCap}</p></div>
            <div className="bg-[#121820] p-3 border border-[#252e38] rounded-sm text-xs"><span className="text-slate-400 font-bold block uppercase text-[9px]">P/E Ratio</span><p className="font-bold text-white mt-0.5">{stock.peRatio}x</p></div>
            <div className="bg-[#121820] p-3 border border-[#252e38] rounded-sm text-xs"><span className="text-slate-400 font-bold block uppercase text-[9px]">Forward P/E</span><p className="font-bold text-white mt-0.5">{stock.forwardPe}x</p></div>
            <div className="bg-[#121820] p-3 border border-[#252e38] rounded-sm text-xs"><span className="text-slate-400 font-bold block uppercase text-[9px]">Profit Margin</span><p className="font-bold text-white mt-0.5">{stock.profitMargin}</p></div>
            <div className="bg-[#121820] p-3 border border-[#252e38] rounded-sm text-xs"><span className="text-slate-400 font-bold block uppercase text-[9px]">Beta</span><p className="font-bold text-white mt-0.5">{stock.beta}x</p></div>
            <div className="bg-[#121820] p-3 border border-[#252e38] rounded-sm text-xs"><span className="text-slate-400 font-bold block uppercase text-[9px]">Div Yield</span><p className="font-bold text-white mt-0.5">{stock.dividendYield}</p></div>
            <div className="bg-[#121820] p-3 border border-[#252e38] rounded-sm text-xs"><span className="text-slate-400 font-bold block uppercase text-[9px]">52W Range</span><p className="font-bold text-white mt-0.5 text-[11px]">{stock.fiftyTwoWeekRange}</p></div>
            <div className="bg-[#121820] p-3 border border-[#252e38] rounded-sm text-xs"><span className="text-slate-400 font-bold block uppercase text-[9px]">Volume</span><p className="font-bold text-white mt-0.5">{stock.volume ? stock.volume.toLocaleString() : 'N/A'}</p></div>
          </div>

          <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-[#252e38] mb-4 gap-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2"><Layers size={14} className="text-[#58a6ff]" /> Interactive Price History</h3>
              <div className="flex gap-1.5 bg-[#090d13] p-1 border border-[#252e38] rounded-sm">
                {(['1M', '6M', '1Y', '5Y'] as const).map((period) => (
                  <button key={period} onClick={() => startTransition(() => setTimeframe(period))} className={`px-3 py-1 text-[9px] font-bold uppercase transition-all rounded-sm focus-visible:ring-2 focus-visible:ring-highlight focus-visible:outline-none ${timeframe === period ? 'bg-[#21262d] text-[#58a6ff] border border-[#30363d]' : 'text-slate-400 hover:text-white border border-transparent'}`}>{period}</button>
                ))}
              </div>
            </div>
            <div className="relative w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stock.chartData[timeframe]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#58a6ff" stopOpacity={0.15}/><stop offset="95%" stopColor="#58a6ff" stopOpacity={0}/></linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#8b949e" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#8b949e" tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#121820', borderColor: '#252e38', fontSize: 11, color: '#c9d1d9' }} />
                  <Area type="monotone" dataKey="price" stroke="#58a6ff" fillOpacity={1} fill="url(#stockGrad)" strokeWidth={1.5} name="Close" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-[#252e38] pb-1.5 mb-3">Corporate Narrative</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">{stock.overview}</p>
              <div className="space-y-3 mt-4 text-xs">
                <div><span className="font-bold text-[#58a6ff] block uppercase text-[10px]">Strategic Valuation</span><p className="text-slate-400 mt-1">{stock.valuation}</p></div>
                <div><span className="font-bold text-[#58a6ff] block uppercase text-[10px]">Financial highlights</span><p className="text-slate-400 mt-1">{stock.financialTrends}</p></div>
              </div>
            </div>
            <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-[#252e38] pb-1.5">Theoretical Option Modeler (30D Black-Scholes)</h3>
              <div className="grid grid-cols-2 gap-4 text-xs border-b border-[#252e38] pb-4">
                <div className="bg-[#090d13] p-2.5 rounded border border-[#252e38]">
                  <span className="font-bold text-white text-[10px] block mb-1 uppercase tracking-wide">At-The-Money (Strike ${stock.price})</span>
                  <div className="flex justify-between"><span>Call Option:</span><span className="green font-bold">{stock.call_atm}</span></div>
                  <div className="flex justify-between"><span>Put Option:</span><span className="green font-bold">{stock.put_atm}</span></div>
                </div>
                <div className="bg-[#090d13] p-2.5 rounded border border-[#252e38]">
                  <span className="font-bold text-white text-[10px] block mb-1 uppercase tracking-wide">Out-Of-Money (Strike ${(stock.price * 1.1).toFixed(2)})</span>
                  <div className="flex justify-between"><span>Call Option:</span><span className="highlight font-bold">{stock.call_otm}</span></div>
                  <div className="flex justify-between"><span>Put Option:</span><span className="highlight font-bold">{stock.put_otm}</span></div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#090d13] p-3 border border-[#252e38] rounded">
                  <span className="font-bold text-[#4ade80] uppercase text-[10px] tracking-wider block mb-2">Bull Thesis</span>
                  <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">{stock.bullCase.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </div>
                <div className="bg-[#090d13] p-3 border border-[#252e38] rounded">
                  <span className="font-bold text-[#f87171] uppercase text-[10px] tracking-wider block mb-2">Bear Thesis</span>
                  <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">{stock.bearCase.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-[#252e38] pb-1.5 mb-3 flex items-center gap-2"><Newspaper size={14} className="text-[#58a6ff]" /> Recent Headlines — {stock.ticker}</h3>
            {newsLoading ? (
              <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-16 bg-[#090d13] border border-[#252e38] rounded-sm animate-pulse" />)}</div>
            ) : (
              <NewsList items={news} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* SUB-VIEW 3.0: WATCHLIST MANAGEMENT VIEW */
function WatchlistView() {
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [activeList, setActiveList] = useState<Watchlist | null>(null);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [newListName, setNewListName] = useState('');
  const [newTicker, setNewTicker] = useState('');
  const [newTargetPrice, setNewTargetPrice] = useState('');
  const [newPriority, setNewPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [newTags, setNewTags] = useState('');
  const [newReviewDate, setNewReviewDate] = useState('');
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => { loadWatchlists(); }, []);

  const loadWatchlists = async () => {
    try {
      const data = await dbService.getWatchlists(); setLists(data);
      if (data.length > 0 && !activeList) { setActiveList(data[0]); loadItems(data[0].id); }
      else { setLoading(false); }
    } catch { setLoading(false); }
  };

  const loadItems = async (id: string) => {
    setLoading(true);
    try { const data = await dbService.getWatchlistItems(id); setItems(data); }
    catch { } finally { setLoading(false); }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newListName.trim()) return;
    try {
      const list = await dbService.createWatchlist(newListName.trim());
      setNewListName(''); setLists([...lists, list]); setActiveList(list); loadItems(list.id);
    } catch { alert('Error creating watchlist'); }
  };

  const handleDeleteList = async (id: string) => {
    if (!confirm('Permanently delete this entire watchlist?')) return;
    try {
      await dbService.deleteWatchlist(id);
      const rem = lists.filter(l => l.id !== id); setLists(rem);
      if (rem.length > 0) { setActiveList(rem[0]); loadItems(rem[0].id); }
      else { setActiveList(null); setItems([]); }
    } catch { alert('Error deleting list'); }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault(); if (!activeList || !newTicker.trim()) return;
    try {
      const newItem = await dbService.addWatchlistItem({
        watchlist_id: activeList.id, ticker: newTicker.toUpperCase().trim(),
        target_price: newTargetPrice ? parseFloat(newTargetPrice) : null,
        priority: newPriority, tags: newTags.split(',').map(t => t.trim()).filter(t => t),
        next_review_date: newReviewDate || null, notes: newNotes.trim()
      });
      setItems([...items, newItem]); setNewTicker(''); setNewTargetPrice(''); setNewTags(''); setNewReviewDate(''); setNewNotes('');
    } catch { alert('Error adding security'); }
  };

  const handleDeleteItem = async (id: string) => {
    try { await dbService.deleteWatchlistItem(id); setItems(items.filter(i => i.id !== id)); }
    catch { alert('Error removing security'); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <div className="terminal-card p-4 rounded-sm">
          <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-[#252e38] pb-1.5 mb-3 flex items-center gap-2"><Bookmark className="w-4 h-4 text-[#58a6ff]" /> Watchlists</h3>
          <form onSubmit={handleCreateList} className="flex gap-2 mb-4">
            <label htmlFor="watchlist-name-input" className="sr-only">Watchlist Name</label>
            <input id="watchlist-name-input" type="text" required value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="List name..." className="bg-[#090d13] border border-[#252e38] text-white px-2 py-1 flex-grow focus:outline-none text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-[#58a6ff]" />
            <button type="submit" className="bg-[#21262d] border border-[#252e38] hover:bg-[#30363d] px-2 py-1 rounded-sm focus-visible:ring-2 focus-visible:ring-[#58a6ff]"><Plus size={14} className="text-[#58a6ff]" /></button>
          </form>
          <div className="space-y-1">
            {lists.map(list => (
              <div key={list.id} onClick={() => { setActiveList(list); loadItems(list.id); }} className={`flex justify-between items-center px-2 py-2 rounded-sm cursor-pointer transition-all ${activeList?.id === list.id ? 'bg-[#21262d] text-white border-l-2 border-[#58a6ff]' : 'text-slate-300 hover:bg-[#161b22]'}`}>
                <span className="font-mono text-xs">{list.name}</span>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }} className="text-slate-400 hover:text-[#f87171] focus-visible:ring-2 focus-visible:ring-highlight" aria-label={`Delete watchlist ${list.name}`}><Trash size={12} /></button>
              </div>
            ))}
            {lists.length === 0 && <p className="text-[10px] text-slate-400 uppercase text-center mt-4">No watchlists configured</p>}
          </div>
        </div>
      </div>

      <div className="lg:col-span-3 space-y-6">
        {activeList ? (
          <>
            <div className="terminal-card p-4 rounded-sm space-y-4">
              <div className="flex justify-between items-center border-b border-[#252e38] pb-2">
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">{activeList.name} Indices</h2>
                <span className="text-[10px] text-slate-400 uppercase font-mono">Count: {items.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#252e38] text-slate-400 font-bold">
                      <th className="pb-2">TICKER</th><th className="pb-2">TARGET PRICE</th><th className="pb-2">PRIORITY</th><th className="pb-2">TAGS</th><th className="pb-2">NEXT REVIEW</th><th className="pb-2">STATUS</th><th className="pb-2 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#252e38]">
                    {items.map(item => {
                      const overdue = item.next_review_date ? new Date(item.next_review_date) < new Date() : false;
                      return (
                        <tr key={item.id} className="hover:bg-[#161b22]/50 text-xs">
                          <td className="py-3 font-bold text-white">{item.ticker}</td>
                          <td className="py-3">${item.target_price || 'N/A'}</td>
                          <td className="py-3">
                            <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${item.priority === 'High' ? 'bg-red-950 text-[#f87171]' : item.priority === 'Medium' ? 'bg-amber-950 text-[#fb923c]' : 'bg-green-950 text-[#4ade80]'}`}>{item.priority}</span>
                          </td>
                          <td className="py-3">
                            <div className="flex gap-1 flex-wrap">
                              {item.tags.map(t => <span key={t} className="px-1.5 py-0.2 bg-[#21262d] border border-[#30363d] rounded text-[9px] text-slate-400">{t}</span>)}
                            </div>
                          </td>
                          <td className={`py-3 ${overdue ? 'text-[#f87171] font-bold' : ''}`}>{item.next_review_date || 'N/A'}</td>
                          <td className="py-3">{overdue ? <span className="flex items-center gap-1 text-[#f87171] font-bold text-[10px] animate-pulse"><AlertTriangle size={12} /> OVERDUE</span> : <span className="text-[#4ade80]">HEALTHY</span>}</td>
                          <td className="py-3 text-right"><button onClick={() => handleDeleteItem(item.id)} className="text-slate-400 hover:text-[#f87171] transition-all focus-visible:ring-2 focus-visible:ring-highlight" aria-label={`Remove ticker ${item.ticker} from watchlist`}><Trash size={14} /></button></td>
                        </tr>
                      );
                    })}
                    {items.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-slate-400 uppercase font-mono">No items in watchlist</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="terminal-card p-4 rounded-sm">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-[#252e38] pb-1.5 mb-4">Add Security</h3>
              <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label htmlFor="ticker-in" className="text-[10px] text-slate-400 uppercase font-bold">Ticker</label>
                  <input id="ticker-in" type="text" required placeholder="e.g. LMT" value={newTicker} onChange={(e) => setNewTicker(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="price-in" className="text-[10px] text-slate-400 uppercase font-bold">Target Price</label>
                  <input id="price-in" type="number" step="0.01" placeholder="e.g. 420.50" value={newTargetPrice} onChange={(e) => setNewTargetPrice(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="priority-in" className="text-[10px] text-slate-400 uppercase font-bold">Priority</label>
                  <select id="priority-in" value={newPriority} onChange={(e) => setNewPriority(e.target.value as any)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight">
                    <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="tags-in" className="text-[10px] text-slate-400 uppercase font-bold">Tags (Comma-separated)</label>
                  <input id="tags-in" type="text" placeholder="e.g. defense, yield" value={newTags} onChange={(e) => setNewTags(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="date-in" className="text-[10px] text-slate-400 uppercase font-bold">Review Date</label>
                  <input id="date-in" type="date" value={newReviewDate} onChange={(e) => setNewReviewDate(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="notes-in" className="text-[10px] text-slate-400 uppercase font-bold">Notes</label>
                  <input id="notes-in" type="text" placeholder="Entry targets..." value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
                </div>
                <div className="md:col-span-3 text-right">
                  <button type="submit" className="bg-[#21262d] border border-[#252e38] hover:bg-[#30363d] text-white px-4 py-2 font-bold uppercase text-[10px] focus-visible:ring-2 focus-visible:ring-highlight">Register Security</button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="terminal-card p-6 rounded-sm text-center">
            <Bookmark className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-1">No Watchlists Selected</h2>
            <p className="text-[10px] text-slate-400 uppercase">Create or select a watchlist in the left sidebar to manage tickers.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* SUB-VIEW 4.0: THESIS TRACKER VIEW */
function ThesisTrackerView() {
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingThesis, setEditingThesis] = useState<Thesis | null>(null);

  const [ticker, setTicker] = useState('');
  const [title, setTitle] = useState('');
  const [originalThesis, setOriginalThesis] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [holdingPeriod, setHoldingPeriod] = useState('Medium-Term');
  const [expectedCatalysts, setExpectedCatalysts] = useState('');
  const [primaryRisks, setPrimaryRisks] = useState('');
  const [strengthen, setStrengthening] = useState('');
  const [weaken, setWeakening] = useState('');
  const [invalidate, setInvalidating] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [status, setStatus] = useState<Thesis['status']>('Active');

  useEffect(() => { loadTheses(); }, []);

  const loadTheses = async () => {
    try { const data = await dbService.getTheses(); setTheses(data); }
    catch { } finally { setLoading(false); }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!ticker || !title || !originalThesis || !entryPrice) return;
    const payload = {
      ticker: ticker.toUpperCase().trim(), title: title.trim(), original_thesis: originalThesis.trim(),
      entry_price: parseFloat(entryPrice) || 0, expected_holding_period: holdingPeriod,
      expected_catalysts: expectedCatalysts.trim(), primary_risks: primaryRisks.trim(),
      strengthening_conditions: strengthen.trim(), weakening_conditions: weaken.trim(), invalidating_conditions: invalidate.trim(),
      target_review_date: reviewDate, status: status
    };
    try {
      if (editingThesis) {
        const updated = await dbService.updateThesis(editingThesis.id, payload);
        setTheses(theses.map(t => t.id === editingThesis.id ? updated : t)); setEditingThesis(null);
      } else {
        const created = await dbService.createThesis(payload); setTheses([...theses, created]);
      }
      resetForm();
    } catch { alert('Error updating thesis desk'); }
  };

  const resetForm = () => {
    setTicker(''); setTitle(''); setOriginalThesis(''); setEntryPrice(''); setHoldingPeriod('Medium-Term');
    setExpectedCatalysts(''); setPrimaryRisks(''); setStrengthening(''); setWeakening(''); setInvalidating(''); setReviewDate(''); setStatus('Active');
  };

  const handleEdit = (t: Thesis) => {
    setEditingThesis(t); setTicker(t.ticker); setTitle(t.title); setOriginalThesis(t.original_thesis);
    setEntryPrice(t.entry_price.toString()); setHoldingPeriod(t.expected_holding_period); setExpectedCatalysts(t.expected_catalysts);
    setPrimaryRisks(t.primary_risks); setStrengthening(t.strengthening_conditions); setWeakening(t.weakening_conditions);
    setInvalidating(t.invalidating_conditions); setReviewDate(t.target_review_date || ''); setStatus(t.status);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this entire investment thesis?')) return;
    try { await dbService.deleteThesis(id); setTheses(theses.filter(t => t.id !== id)); }
    catch { alert('Error deleting thesis'); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="terminal-card p-4 rounded-sm space-y-4">
          <div className="border-b border-[#252e38] pb-1.5 flex justify-between items-center">
            <h2 className="text-xs font-bold text-white uppercase tracking-widest">{editingThesis ? 'Edit Thesis Draft' : 'Add Investment Thesis'}</h2>
            {editingThesis && <button onClick={() => { setEditingThesis(null); resetForm(); }} className="text-[9px] text-[#fb923c] font-bold border border-[#fb923c]/40 px-1 rounded-sm focus-visible:ring-2 focus-visible:ring-highlight">CANCEL EDIT</button>}
          </div>
          <form onSubmit={handleCreateOrUpdate} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="t-ticker" className="text-[10px] text-slate-400 uppercase font-bold">Ticker</label>
                <input id="t-ticker" type="text" required placeholder="e.g. MSFT" value={ticker} onChange={(e) => setTicker(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
              </div>
              <div className="space-y-1">
                <label htmlFor="t-price" className="text-[10px] text-slate-400 uppercase font-bold">Entry Price</label>
                <input id="t-price" type="number" step="0.01" required placeholder="e.g. 420.50" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="t-title" className="text-[10px] text-slate-400 uppercase font-bold">Thesis Title</label>
              <input id="t-title" type="text" required placeholder="Enterprise software domination..." value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
            </div>
            <div className="space-y-1">
              <label htmlFor="t-core" className="text-[10px] text-slate-400 uppercase font-bold">Core Thesis Arguments</label>
              <textarea id="t-core" required placeholder="Detail structural moats, margins expansion..." value={originalThesis} onChange={(e) => setOriginalThesis(e.target.value)} rows={3} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono leading-relaxed focus-visible:ring-2 focus-visible:ring-highlight" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="t-period" className="text-[10px] text-slate-400 uppercase font-bold">Expected Horizon</label>
                <input id="t-period" type="text" placeholder="e.g. 2-3 Years" value={holdingPeriod} onChange={(e) => setHoldingPeriod(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
              </div>
              <div className="space-y-1">
                <label htmlFor="t-review" className="text-[10px] text-slate-400 uppercase font-bold">Target Review</label>
                <input id="t-review" type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="t-catalysts" className="text-[10px] text-slate-400 uppercase font-bold">Expected Catalysts</label>
              <input id="t-catalysts" type="text" placeholder="e.g. Copilot monetization..." value={expectedCatalysts} onChange={(e) => setExpectedCatalysts(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
            </div>
            <div className="space-y-1">
              <label htmlFor="t-risks" className="text-[10px] text-slate-400 uppercase font-bold">Primary Risks</label>
              <input id="t-risks" type="text" placeholder="e.g. Capex margin decompression..." value={primaryRisks} onChange={(e) => setPrimaryRisks(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
            </div>
            <div className="border-t border-[#252e38] pt-2 space-y-2">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Condition Scenarios Modeling</p>
              <div className="space-y-1">
                <label htmlFor="t-strengthen" className="text-[9px] text-[#4ade80] uppercase font-bold">Strengthening</label>
                <input id="t-strengthen" type="text" placeholder="Operating margins exceed 40%..." value={strengthen} onChange={(e) => setStrengthening(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
              </div>
              <div className="space-y-1">
                <label htmlFor="t-weaken" className="text-[9px] text-amber-500 uppercase font-bold">Weakening</label>
                <input id="t-weaken" type="text" placeholder="Subscriber churn increases..." value={weaken} onChange={(e) => setWeakening(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
              </div>
              <div className="space-y-1">
                <label htmlFor="t-invalidate" className="text-[9px] text-[#f87171] uppercase font-bold">Invalidating</label>
                <input id="t-invalidate" type="text" placeholder="Strategic acquisitions integration..." value={invalidate} onChange={(e) => setInvalidating(e.target.value)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight" />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="t-status" className="text-[10px] text-slate-400 uppercase font-bold">Current Status</label>
              <select id="t-status" value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full bg-[#090d13] border border-[#252e38] text-white px-2 py-1.5 text-xs rounded-sm font-mono focus-visible:ring-2 focus-visible:ring-highlight">
                <option value="Active">Active</option><option value="Strengthened">Strengthened</option><option value="Unchanged">Unchanged</option><option value="Weakened">Weakened</option><option value="Invalidated">Invalidated</option><option value="Closed">Closed</option>
              </select>
            </div>
            <div className="pt-2 text-right">
              <button type="submit" className="bg-[#21262d] border border-[#252e38] hover:bg-[#30363d] text-white px-4 py-2 font-bold uppercase text-[10px] focus-visible:ring-2 focus-visible:ring-highlight">{editingThesis ? 'Apply Updates' : 'Publish Thesis'}</button>
            </div>
          </form>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="terminal-card p-4 rounded-sm">
          <div className="border-b border-[#252e38] pb-1.5 flex justify-between items-center mb-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-widest">Active Investment Theses Desk</h2>
            <span className="text-[10px] text-slate-400 uppercase font-mono">Count: {theses.length}</span>
          </div>
          <div className="space-y-4">
            {theses.map(t => (
              <div key={t.id} className="bg-[#090d13] p-4 border border-[#252e38] rounded-sm space-y-3">
                <div className="flex justify-between items-start border-b border-[#21262d] pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#58a6ff] font-bold text-xs uppercase bg-[#21262d] border border-[#30363d] px-2 py-0.5 rounded-sm">{t.ticker}</span>
                      <span className="text-white font-bold text-xs">{t.title}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 uppercase font-mono mt-1">Cost Basis: ${t.entry_price} // Horizon: {t.expected_holding_period}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${t.status === 'Strengthened' ? 'bg-green-950 text-[#4ade80]' : t.status === 'Weakened' ? 'bg-red-950 text-[#f87171]' : t.status === 'Invalidated' ? 'bg-red-950 text-[#f87171] animate-pulse border border-red-900' : 'bg-[#21262d] text-gray-300'}`}>{t.status.toUpperCase()}</span>
                    <button onClick={() => handleEdit(t)} className="text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-highlight" aria-label="Edit"><Edit3 size={14} /></button>
                    <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-[#f87171] focus-visible:ring-2 focus-visible:ring-highlight" aria-label="Delete"><Trash size={14} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] leading-relaxed">
                  <div className="space-y-2">
                    <p className="text-slate-300"><span className="text-gray-500 font-bold uppercase block text-[9px]">Thesis:</span> {t.original_thesis}</p>
                    <p className="text-slate-400"><span className="text-gray-500 font-bold uppercase block text-[9px]">Expected Catalysts:</span> {t.expected_catalysts || 'N/A'}</p>
                    <p className="text-slate-400"><span className="text-gray-500 font-bold uppercase block text-[9px]">Primary Risks:</span> {t.primary_risks || 'N/A'}</p>
                  </div>
                  <div className="bg-[#121820]/50 p-2.5 rounded border border-[#21262d]/50 space-y-2 text-[10px]">
                    <span className="text-slate-400 font-bold block uppercase text-[9px] tracking-wide">Conditions Mapping</span>
                    <p className="text-[#4ade80]"><strong className="text-[9px] block">STRENGTHENING:</strong> {t.strengthening_conditions || 'N/A'}</p>
                    <p className="text-amber-500"><strong className="text-[9px] block">WEAKENING:</strong> {t.weakening_conditions || 'N/A'}</p>
                    <p className="text-[#f87171]"><strong className="text-[9px] block">INVALIDATING:</strong> {t.invalidating_conditions || 'N/A'}</p>
                  </div>
                </div>
                {t.target_review_date && <div className="text-right text-[9px] text-slate-400 uppercase font-mono">Next Target Review: {t.target_review_date}</div>}
              </div>
            ))}
            {theses.length === 0 && <div className="text-center py-8 text-slate-400 uppercase font-mono"><FileText className="w-12 h-12 text-slate-400 mx-auto mb-2" />No theses documented.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}