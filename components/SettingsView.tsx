'use client';

import React, { useState } from 'react';
import { Settings, Database, ShieldAlert, AlertTriangle } from 'lucide-react';
import { RiskProfile } from '../lib/quiz';

export default function SettingsView({
  userEmail, riskProfile, onRetake, onSignOut, onResetData
}: {
  userEmail: string; riskProfile: RiskProfile | null; onRetake: () => void; onSignOut: () => void; onResetData: () => void;
}) {
  const [showPlaidInfo, setShowPlaidInfo] = useState(false);
  const [resetPending, setResetPending] = useState(false);

  const handleReset = () => {
    if (!resetPending) { setResetPending(true); return; }
    setResetPending(false);
    onResetData();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-4"><Settings size={16} className="text-[#58a6ff]" /> Account</h2>
        <div className="flex items-center justify-between text-xs">
          <div><span className="text-[10px] text-slate-400 uppercase font-bold block">Signed in as</span><span className="text-white font-bold">{userEmail}</span></div>
          <button onClick={onSignOut} className="text-[9px] bg-red-950 text-red-200 border border-red-900 px-2 py-1 rounded font-bold hover:bg-red-900 hover:text-white">LOGOUT</button>
        </div>
      </div>

      <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-1"><Database size={16} className="text-[#58a6ff]" /> Brokerage Connection</h2>
        <p className="text-[10px] text-slate-400 uppercase mb-4">Plaid / real account linking</p>
        <div className="flex items-center justify-between bg-[#090d13] p-3 border border-[#252e38] rounded-sm">
          <div>
            <span className="text-xs font-bold text-white block">Connect a brokerage account</span>
            <span className="text-[10px] text-slate-400">Requires a Plaid Link integration (see below)</span>
          </div>
          <button onClick={() => setShowPlaidInfo(!showPlaidInfo)} className="bg-[#21262d] border border-[#252e38] text-white px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm">
            {showPlaidInfo ? 'Hide details' : 'Connect'}
          </button>
        </div>
        {showPlaidInfo && (
          <div className="mt-3 bg-blue-950/20 border border-blue-900/50 p-3 rounded text-[10px] leading-relaxed text-blue-200 space-y-2">
            <p>To wire up real Plaid connectivity here, you'll need:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>A Plaid developer account and API keys (client_id + secret) in your <code>.env.local</code>.</li>
              <li>A server route (e.g. <code>app/api/plaid/create-link-token/route.ts</code>) that calls Plaid's <code>/link/token/create</code> to get a link token.</li>
              <li>The Plaid Link JS SDK on the client, opened with that link token, which returns a <code>public_token</code> on success.</li>
              <li>Another server route to exchange that <code>public_token</code> for a permanent <code>access_token</code>, stored server-side (e.g. in Supabase, encrypted).</li>
              <li>Calls to Plaid's <code>/accounts/balance/get</code> or <code>/investments/holdings/get</code> using that access token to pull real data.</li>
            </ol>
            <p>None of this can run without a live server, which is why it didn't work when tried directly — that's the actual next build step, not a bug.</p>
          </div>
        )}
      </div>

      <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-4"><ShieldAlert size={16} className="text-[#58a6ff]" /> Risk Profile</h2>
        {riskProfile ? (
          <div className="flex items-center justify-between text-xs">
            <div><span className="text-[10px] text-slate-400 uppercase font-bold block">Current Profile</span><span className="text-white font-bold">{riskProfile.bucket} ({riskProfile.score}/100)</span></div>
            <button onClick={onRetake} className="bg-[#21262d] border border-[#252e38] text-white px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm">Retake Quiz</button>
          </div>
        ) : <p className="text-xs text-slate-400">No profile set yet.</p>}
      </div>

      <div className="bg-[#121820] p-4 border border-[#252e38] rounded-sm">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-1"><AlertTriangle size={16} className="text-orange-400" /> Data</h2>
        <p className="text-[10px] text-slate-400 mb-3">Clears watchlists, theses, and your risk profile, then signs you out.</p>
        <button onClick={handleReset} className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-sm border ${resetPending ? 'bg-red-950 border-red-900 text-red-300' : 'bg-[#21262d] border-[#252e38] text-white'}`}>
          {resetPending ? 'Click again to confirm reset' : 'Reset all data'}
        </button>
      </div>
    </div>
  );
}
