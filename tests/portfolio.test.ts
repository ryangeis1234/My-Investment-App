import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAllocation } from '../lib/quiz';
import { deriveScores, targetVolFor, CMA_TABLE } from '../lib/portfolio';
import { applyStockPicks } from '../lib/stocks';

/** every quiz answer set to the same 0-4 value, optionally overriding a few */
const answers = (v: number, over: Record<string, number> = {}) => ({
  horizon: v, drawdown: v, single_shock: v, correlated_crash: v, experience: v,
  goal: v, concentration: v, leverage: v, prolonged: v, ...over,
});

test('category and holding weights each sum to 100 for every vehicle at every risk level', () => {
  for (let v = 0; v <= 4; v++) {
    for (const vehicle of ['etf', 'stocks', 'mutual', 'mix']) {
      const { score } = deriveScores(answers(v));
      const a = computeAllocation(score, vehicle, ['Technology'], answers(v), 'balanced');
      const catSum = a.categories.reduce((s, c) => s + c.weight, 0);
      const holdSum = a.holdings.reduce((s, h) => s + h.weight, 0);
      assert.ok(Math.abs(catSum - 100) < 0.01, `categories sum ${catSum} (v=${v}, ${vehicle})`);
      assert.ok(Math.abs(holdSum - 100) < 0.01, `holdings sum ${holdSum} (v=${v}, ${vehicle})`);
    }
  }
});

test('target volatility never decreases as the risk score rises', () => {
  const sub = { horizon: 1, tolerance: 1, capacity: 1, experience: 1, leverageComfort: 1 };
  let prev = 0;
  for (let s = 0; s <= 100; s += 5) {
    const tv = targetVolFor(s, sub);
    assert.ok(tv >= prev, `target vol fell at score ${s}`);
    prev = tv;
  }
});

test('the optimizer lands on its volatility target for mid-range profiles', () => {
  for (const v of [1, 2, 3]) {
    const { score } = deriveScores(answers(v));
    const a = computeAllocation(score, 'etf', [], answers(v), 'balanced');
    assert.ok(Math.abs(a.achievedVol - a.targetVol) / a.targetVol < 0.08, `v=${v}: ${a.achievedVol} vs ${a.targetVol}`);
  }
});

test('a riskier profile is built with higher volatility than a safer one', () => {
  const safe = computeAllocation(deriveScores(answers(1)).score, 'etf', [], answers(1), 'balanced');
  const bold = computeAllocation(deriveScores(answers(3)).score, 'etf', [], answers(3), 'balanced');
  assert.ok(bold.stats.volatility > safe.stats.volatility);
});

test('leveraged and speculative sleeves stay off for a leverage-averse investor', () => {
  const a = computeAllocation(0, 'etf', [], answers(4, { leverage: 0 }), 'balanced');
  assert.ok(!a.categories.some((c) => c.category === 'Leveraged Equity'));
});

test('a 3x leveraged ETF is modeled with far less than 3x the index return (volatility decay)', () => {
  const core = CMA_TABLE['Core Broad Market'];
  const lev = CMA_TABLE['Leveraged Equity'];
  assert.ok(lev.mu < 2 * core.mu, 'decay should eat most of the 3x');
  assert.ok(Math.abs(lev.sigma - 3 * core.sigma) < 1e-9, 'volatility should triple');
});

test('picked stocks keep the sector ETF and never duplicate a ticker', () => {
  const a = computeAllocation(75, 'mix', [], answers(3), 'balanced');
  const picked = applyStockPicks(a, ['AAPL', 'MSFT', 'UNH']);
  const tickers = picked.holdings.map((h) => h.ticker);
  assert.equal(new Set(tickers).size, tickers.length, 'duplicate ticker');
  assert.ok(tickers.includes('QQQ'), 'Growth/Tech ETF must stay alongside its stocks');
  assert.ok(tickers.includes('AAPL') && tickers.includes('MSFT'));
  const sum = picked.holdings.reduce((s, h) => s + h.weight, 0);
  assert.ok(Math.abs(sum - 100) < 0.01);
});
