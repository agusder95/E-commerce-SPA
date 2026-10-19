import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonError, comparisonPeriods, comparisonPriceRows, toggleComparisonProduct } from '../src/features/admin/model/productComparison.js';
import { priceGeometry } from '../src/features/admin/model/statistics.js';

test('selection enforces three distinct products and preserves surviving colors when replacing a product', () => {
  let selected = [];
  for (const id of [1, 2, 3]) selected = toggleComparisonProduct(selected, id);
  assert.equal(new Set(selected.map(product => product.color)).size, 3);
  assert.equal(toggleComparisonProduct(selected, 4), selected);
  const color = selected[2].color;
  selected = toggleComparisonProduct(selected, 2);
  selected = toggleComparisonProduct(selected, 4);
  assert.equal(selected.find(product => product.id === '3').color, color);
  assert.equal(new Set(selected.map(product => product.color)).size, 3);
  assert.equal(selected.filter(product => product.id === '4').length, 1);
});

test('comparison rejects empty, duplicate and oversized selections and validates the common date range', () => {
  const draft = { selection: [{ id: '1' }], from: '2026-01-01', to: '2026-01-02', groupBy: 'day' };
  assert.equal(comparisonError(draft), '');
  for (const selection of [[], [{ id: '1' }, { id: '1' }], [1, 2, 3, 4].map(id => ({ id: String(id) }))]) {
    assert.ok(comparisonError({ ...draft, selection }));
  }
  assert.ok(comparisonError({ ...draft, from: '2026-01-03' }));
});

test('comparison aligns dates while distinguishing unavailable data from actual zero sales', () => {
  const series = [
    { product: { id: '1' }, data: { periods: [{ periodStart: '2026-01-01', quantity: 0 }, { periodStart: '2026-01-02', quantity: 2 }] } },
    { product: { id: '2' }, data: null, error: 'No disponible' },
    { product: { id: '3' }, data: { periods: [{ periodStart: '2026-01-02', quantity: 3 }] } },
  ];
  const periods = comparisonPeriods(series);
  assert.equal(periods.length, 2);
  assert.equal(periods[0].values[0].period.quantity, 0);
  assert.equal(periods[0].values[1].period, null);
  assert.equal(periods[0].values[2].period, null);
  assert.equal(periods[1].values[2].period.quantity, 3);
});

test('price comparisons share axes, preserve gaps and keep historical rows attached to their products', () => {
  const query = { from: '2026-01-01', to: '2026-01-03' };
  const first = [{ from: '2026-01-01T03:00:00Z', to: '2026-01-02T03:00:00Z', listPrice: 100, effectivePrice: 80 },
    { from: '2026-01-03T03:00:00Z', to: '2026-01-04T03:00:00Z', listPrice: 100, effectivePrice: 100 }];
  const second = [{ from: '2026-01-01T03:00:00Z', to: '2026-01-04T03:00:00Z', listPrice: 200, effectivePrice: 100 }];
  const a = priceGeometry(first, query, 720, 220, 200);
  const b = priceGeometry(second, query, 720, 220, 200);
  assert.equal(a.y(100), b.y(100));
  assert.equal(a.x(first[0].from), b.x(second[0].from));
  assert.equal(a.effectivePath.split('M').length - 1, 2);
  const rows = comparisonPriceRows([{ product: { id: '1' }, data: { periods: first } }, { product: { id: '2' }, data: { periods: second } }]);
  assert.deepEqual(rows.map(row => row.product.id), ['1', '2', '1']);
});
