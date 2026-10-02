import { supabase, isSupabaseConfigured } from './supabase';
import { RiskProfile, computeAllocation } from '../lib/quiz';

/** Older stored profiles predate the portfolio engine — rebuild the allocation
 *  (stats / frontier / rebalancing) from the saved score + answers so the UI
 *  never reads an undefined field. */
function rehydrateProfile(p: RiskProfile | null): RiskProfile | null {
  if (!p) return null;
  if (p.allocation && (p.allocation as any).stats) return p;
  const allocation = computeAllocation(p.score, p.vehicle, p.sectors, p.answers, p.downtrendStyle ?? null);
  return { ...p, allocation };
}

export interface ChartPoint { date: string; price: number; }

export interface StockData {
  companyName: string; ticker: string; price: number; dailyChange: number; dailyChangePct: number;
  marketCap: string; peRatio: number | string; forwardPe: number | string; revenueGrowth: string;
  earningsGrowth: string; profitMargin: string; fiftyTwoWeekRange: string; beta: number; dividendYield: string;
  overview: string; financialTrends: string; valuation: string; recentPerformance: string;
  risks: string[]; catalysts: string[]; bullCase: string[]; bearCase: string[];
  chartData: { '1M': ChartPoint[]; '6M': ChartPoint[]; '1Y': ChartPoint[]; '5Y': ChartPoint[]; };
  call_atm: string; put_atm: string; call_otm: string; put_otm: string;
  volume: number | null; dayRange: string | null; exchange: string | null;
  /** which top-level fields on this response came from a live Yahoo Finance quote vs. illustrative research notes */
  liveFields: string[];
}

export interface NewsItem { title: string; link: string; pubDate: string; description: string; source: string }

export interface Watchlist { id: string; name: string; created_at?: string; }

export interface WatchlistItem {
  id: string; watchlist_id: string; ticker: string; target_price: number | null;
  priority: 'Low' | 'Medium' | 'High'; tags: string[]; next_review_date: string | null; notes: string;
}

export interface Thesis {
  id: string; ticker: string; title: string; original_thesis: string; entry_price: number;
  expected_holding_period: string; expected_catalysts: string; primary_risks: string;
  strengthening_conditions: string; weakening_conditions: string; invalidating_conditions: string;
  target_review_date: string; status: 'Active' | 'Strengthened' | 'Unchanged' | 'Weakened' | 'Invalidated' | 'Closed';
  created_at?: string;
}

export const mockMetrics = {
  totalPortfolioValue: 124850.42, totalReturnPct: 24.85, dailyReturnPct: 1.12, benchmarkReturnPct: 18.40,
  portfolioBeta: 1.18, maxDrawdownPct: -8.45, cashBalance: 15430.00,
  bestHolding: { ticker: "NVDA", returnPct: 84.20 }, worstHolding: { ticker: "BA", returnPct: -18.45 },
  recentThesisChanges: [
    { ticker: "MSFT", title: "Enterprise Copilot Growth", status: "Strengthened", timestamp: "2026-07-18 14:32" },
    { ticker: "LMT", title: "Global Defense Spends", status: "Unchanged", timestamp: "2026-07-18 11:15" },
    { ticker: "AAPL", title: "Consumer Hardware Cycle", status: "Weakened", timestamp: "2026-07-17 09:40" }
  ],
  recentBotTrades: [
    { ticker: "TSLA", action: "BUY" as const, price: 184.20, strategy: "MeanReversion_1H", timestamp: "10 mins ago" },
    { ticker: "AMD", action: "SELL" as const, price: 154.60, strategy: "RSI_Breakout_15M", timestamp: "1 hour ago" },
    { ticker: "XOM", action: "BUY" as const, price: 114.30, strategy: "MacroTrendFollower", timestamp: "4 hours ago" }
  ],
  watchlistAlerts: [
    { ticker: "PLTR", message: "Price crossed Target $25.00 threshold", type: "PRICE_CROSS" as const },
    { ticker: "RTX", message: "Thesis target review date is overdue", type: "THESIS_DUE" as const },
    { ticker: "AVGO", message: "Daily movement (> 5.4%) exceeds historical limits", type: "VOL_ALERT" as const }
  ]
};

export const mockPortfolioHistory = [
  { date: 'Jan', portfolio: 100000, benchmark: 100000 },
  { date: 'Feb', portfolio: 104200, benchmark: 102100 },
  { date: 'Mar', portfolio: 102100, benchmark: 101500 },
  { date: 'Apr', portfolio: 108400, benchmark: 104300 },
  { date: 'May', portfolio: 112100, benchmark: 106100 },
  { date: 'Jun', portfolio: 118900, benchmark: 111400 },
  { date: 'Jul', portfolio: 124850, benchmark: 118400 },
];

export const mockAllocation = [
  { name: 'Technology', value: 55 },
  { name: 'Defense', value: 25 },
  { name: 'Energy', value: 10 },
  { name: 'Cash', value: 10 },
];

export const ALLOCATION_COLORS = ['#4ade80', '#58a6ff', '#fb923c', '#8b949e'];

export async function fetchStockData(symbol: string): Promise<StockData> {
  const res = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol.trim().toUpperCase())}`);
  if (!res.ok) throw new Error('Failed to fetch financial metrics from API');
  return res.json();
}

export async function fetchNews(symbol?: string): Promise<NewsItem[]> {
  const url = symbol ? `/api/news?symbol=${encodeURIComponent(symbol.trim().toUpperCase())}` : '/api/news';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch news feed');
  const data = await res.json();
  return data.items as NewsItem[];
}

const genLocalId = () => Math.random().toString(36).substring(2, 11);

export const dbService = {
  async getWatchlists(): Promise<Watchlist[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('watchlists').select('*');
      if (error) throw error;
      return data || [];
    }
    return JSON.parse(localStorage.getItem('sl_watchlists') || '[]');
  },

  async createWatchlist(name: string): Promise<Watchlist> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('watchlists').insert([{ name }]).select().single();
      if (error) throw error;
      return data;
    }
    const newList: Watchlist = { id: genLocalId(), name, created_at: new Date().toISOString() };
    const lists = await this.getWatchlists();
    lists.push(newList);
    localStorage.setItem('sl_watchlists', JSON.stringify(lists));
    return newList;
  },

  async deleteWatchlist(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('watchlists').delete().eq('id', id);
      if (error) throw error;
    } else {
      const lists = await this.getWatchlists();
      localStorage.setItem('sl_watchlists', JSON.stringify(lists.filter(i => i.id !== id)));
      const items = JSON.parse(localStorage.getItem('sl_watchlist_items') || '[]') as WatchlistItem[];
      localStorage.setItem('sl_watchlist_items', JSON.stringify(items.filter(i => i.watchlist_id !== id)));
    }
  },

  async getWatchlistItems(watchlistId: string): Promise<WatchlistItem[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('watchlist_items').select('*').eq('watchlist_id', watchlistId);
      if (error) throw error;
      return data || [];
    }
    const items = JSON.parse(localStorage.getItem('sl_watchlist_items') || '[]') as WatchlistItem[];
    return items.filter(i => i.watchlist_id === watchlistId);
  },

  async addWatchlistItem(item: Omit<WatchlistItem, 'id'>): Promise<WatchlistItem> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('watchlist_items').insert([item]).select().single();
      if (error) throw error;
      return data;
    }
    const newItem: WatchlistItem = { ...item, id: genLocalId() };
    const items = JSON.parse(localStorage.getItem('sl_watchlist_items') || '[]') as WatchlistItem[];
    items.push(newItem);
    localStorage.setItem('sl_watchlist_items', JSON.stringify(items));
    return newItem;
  },

  async deleteWatchlistItem(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('watchlist_items').delete().eq('id', id);
      if (error) throw error;
    } else {
      const items = JSON.parse(localStorage.getItem('sl_watchlist_items') || '[]') as WatchlistItem[];
      localStorage.setItem('sl_watchlist_items', JSON.stringify(items.filter(i => i.id !== id)));
    }
  },

  async getTheses(): Promise<Thesis[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('theses').select('*');
      if (error) throw error;
      return data || [];
    }
    return JSON.parse(localStorage.getItem('sl_theses') || '[]');
  },

  async createThesis(thesis: Omit<Thesis, 'id' | 'created_at'>): Promise<Thesis> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('theses').insert([thesis]).select().single();
      if (error) throw error;
      return data;
    }
    const newThesis: Thesis = { ...thesis, id: genLocalId(), created_at: new Date().toISOString() };
    const list = await this.getTheses();
    list.push(newThesis);
    localStorage.setItem('sl_theses', JSON.stringify(list));
    return newThesis;
  },

  async updateThesis(id: string, updates: Partial<Thesis>): Promise<Thesis> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('theses').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }
    const list = await this.getTheses();
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) throw new Error('Thesis not found');
    const updated = { ...list[idx], ...updates };
    list[idx] = updated;
    localStorage.setItem('sl_theses', JSON.stringify(list));
    return updated;
  },

  async deleteThesis(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('theses').delete().eq('id', id);
      if (error) throw error;
    } else {
      const list = await this.getTheses();
      localStorage.setItem('sl_theses', JSON.stringify(list.filter(i => i.id !== id)));
    }
  },

  async getRiskProfile(): Promise<RiskProfile | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('risk_profiles').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return rehydrateProfile(data as RiskProfile | null);
    }
    const raw = localStorage.getItem('sl_risk_profile');
    return rehydrateProfile(raw ? JSON.parse(raw) : null);
  },

  async saveRiskProfile(profile: RiskProfile): Promise<RiskProfile> {
    if (isSupabaseConfigured && supabase) {
      const { data: existing } = await supabase.from('risk_profiles').select('id').limit(1).maybeSingle();
      if (existing) {
        const { data, error } = await supabase.from('risk_profiles').update(profile).eq('id', (existing as any).id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('risk_profiles').insert([profile]).select().single();
      if (error) throw error;
      return data;
    }
    localStorage.setItem('sl_risk_profile', JSON.stringify(profile));
    return profile;
  },

  async deleteRiskProfile(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('risk_profiles').delete().neq('id', '');
      if (error) throw error;
    } else {
      localStorage.removeItem('sl_risk_profile');
    }
  },

  // demo account balance — a per-browser modeling input, not synced account data,
  // so it always lives in localStorage regardless of Supabase configuration.
  async getBalance(): Promise<number> {
    const raw = localStorage.getItem('sl_balance');
    const n = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 100000;
  },

  async saveBalance(amount: number): Promise<number> {
    const clamped = Math.max(0, Math.round(amount));
    localStorage.setItem('sl_balance', String(clamped));
    return clamped;
  }
};