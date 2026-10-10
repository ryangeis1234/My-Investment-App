import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBacktest, seriesStats, PricePoint } from '../lib/backtest';

const START = 1_700_000_000;
const weekly = (n: number, f: (i: number) => number, offsetWeeks = 0): PricePoint[] =>
  Array.from({ length: n }, (_, i) => ({ t: START + (i + offsetWeeks) * 7 * 86400, close: f(i + offsetWeeks) }));

test('seriesStats measures drawdown from the running peak', () => {
  const s = seriesStats([100, 120, 60, 90]);
  assert.ok(Math.abs(s.maxDrawdown - -0.5) < 1e-9);
  assert.ok(Math.abs(s.totalReturn - -0.1) < 1e-9);
});

test('a flat portfolio has no return, no volatility and no drawdown', () => {
  const flat = weekly(80, () => 50);
  const r = runBacktest({ A: 1 }, { A: flat, BM: flat }, 'BM')!;
  assert.equal(r.portfolioStats.totalReturn, 0);
  assert.equal(r.portfolioStats.annVol, 0);
  assert.equal(r.portfolioStats.maxDrawdown, 0);
});

test('compounding 1% per week is reported as 1.01^weeks - 1', () => {
  const grow = weekly(60, (i) => 100 * 1.01 ** i);
  const r = runBacktest({ A: 1 }, { A: grow, BM: grow }, 'BM')!;
  assert.ok(Math.abs(r.portfolioStats.totalReturn - (1.01 ** 59 - 1)) < 1e-9);
  assert.ok(Math.abs(r.benchmarkStats.totalReturn - r.portfolioStats.totalReturn) < 1e-9);
});

test('the holding with the shortest history is dropped when the shared window is too short', () => {
  const long = weekly(100, (i) => 100 + i);
  const short = weekly(20, (i) => 100 + i, 80);   // starts 80 weeks in
  const r = runBacktest({ A: 0.5, B: 0.5 }, { A: long, B: short, BM: long }, 'BM', 13, 52)!;
  assert.deepEqual(r.usedTickers, ['A']);
  assert.deepEqual(r.droppedTickers, ['B']);
  assert.equal(r.weeks, 99);
});

test('a ticker with no price data is reported as dropped, not silently ignored', () => {
  const ok = weekly(80, (i) => 100 + i);
  const r = runBacktest({ A: 0.5, GHOST: 0.5 }, { A: ok, GHOST: null, BM: ok }, 'BM')!;
  assert.deepEqual(r.droppedTickers, ['GHOST']);
});

test('rebalancing changes the result when one holding outgrows the other', () => {
  const flat = weekly(80, () => 100);
  const up = weekly(80, (i) => 100 * 1.02 ** i);
  const never = runBacktest({ F: 0.5, U: 0.5 }, { F: flat, U: up, BM: flat }, 'BM', 10_000)!;
  const often = runBacktest({ F: 0.5, U: 0.5 }, { F: flat, U: up, BM: flat }, 'BM', 1)!;
  assert.notEqual(never.portfolio[79].toFixed(6), often.portfolio[79].toFixed(6));
  assert.ok(never.portfolio[79] > 100 && often.portfolio[79] > 100);
});
