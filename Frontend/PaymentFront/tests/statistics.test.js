import test from 'node:test';
import assert from 'node:assert/strict';
import { storeToday, presetRange, statisticsError, periodBounds, priceGeometry, productLabel } from '../src/features/admin/model/statistics.js';

test('quick ranges include today and follow the store timezone at a UTC month boundary', () => {
  const today = storeToday(new Date('2026-03-01T01:00:00Z'));
  assert.equal(today, '2026-02-28');
  assert.deepEqual(presetRange('7', today), { from: '2026-02-22', to: today, groupBy: 'day' });
  assert.deepEqual(presetRange('30', '2024-03-01'), { from: '2024-02-01', to: '2024-03-01', groupBy: 'day' });
  assert.equal(presetRange('90', today).groupBy, 'week');
  assert.deepEqual(presetRange('year', '2026-10-16'), { from: '2026-01-01', to: '2026-10-16', groupBy: 'month' });
});

test('invalid, reversed, future and oversized date ranges are rejected before fetching', () => {
  const filters = { productId: '12', from: '2026-02-01', to: '2026-02-28', groupBy: 'day' };
  assert.equal(statisticsError(filters, '2026-03-01'), '');
  for (const changes of [{ productId: '' }, { from: '' }, { to: '2026-02-30' }, { from: '2026-03-01' },
    { to: '2026-03-02' }, { from: '2010-01-01' }]) {
    assert.ok(statisticsError({ ...filters, ...changes }, '2026-03-01'));
  }
});

test('week and month labels clip to the selected range instead of implying unqueried sales', () => {
  assert.deepEqual(periodBounds('2026-09-28', { from: '2026-10-01', to: '2026-10-03', groupBy: 'week' }),
    { from: '2026-10-01', to: '2026-10-03' });
  assert.deepEqual(periodBounds('2024-02-01', { from: '2024-02-08', to: '2024-03-08', groupBy: 'month' }),
    { from: '2024-02-08', to: '2024-02-29' });
});

test('price geometry preserves actual durations, expiration steps and unknown gaps', () => {
  const periods = [
    { from: '2026-10-01T03:00:00Z', to: '2026-10-02T03:00:00Z', listPrice: 100, effectivePrice: 80 },
    { from: '2026-10-02T03:00:00Z', to: '2026-10-04T03:00:00Z', listPrice: 100, effectivePrice: 100 },
    { from: '2026-10-05T03:00:00Z', to: '2026-10-06T03:00:00Z', listPrice: 120, effectivePrice: 120 },
  ];
  const graph = priceGeometry(periods, { from: '2026-10-01', to: '2026-10-05' });
  assert.equal(graph.effectivePath.split('M').length - 1, 2, 'a gap starts a new path');
  assert.equal(graph.y(0), 190);
  const oneDay = graph.x(periods[0].to) - graph.x(periods[0].from);
  const twoDays = graph.x(periods[1].to) - graph.x(periods[1].from);
  assert.ok(Math.abs(twoDays - 2 * oneDay) < 0.00001);
  assert.ok(graph.effectivePath.includes(`L${graph.x(periods[1].from)},${graph.y(100)}`), 'expiration immediately raises the price');
});

test('product options distinguish physical, digital and deleted products with the same name', () => {
  assert.equal(productLabel({ name: 'Libro', type: 'PHYSICAL' }), 'Libro · Físico');
  assert.equal(productLabel({ name: 'Libro', type: 'DIGITAL', isDeleted: true }), 'Libro · Digital · Eliminado');
});
