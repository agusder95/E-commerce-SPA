import test from 'node:test';
import assert from 'node:assert/strict';
import { sortPurchases } from '../src/features/orders/model/purchaseSort.js';
import { nextTableSort } from '../src/shared/utils/tableSort.js';

const purchases = [
  { orderId: 10, createdAt: '2026-10-19T10:00:00Z', status: 'APPROVED', totalAmount: 900, items: [] },
  { orderId: 2, createdAt: '2026-10-19T09:00:00Z', status: 'PENDING_PAYMENT', items: [{ quantity: 2, finalUnitPrice: 50 }] },
  { orderId: 3, createdAt: null, status: 'CANCELLED', totalAmount: 200, items: [] },
];

test('customer purchases sort every displayed field in both directions without mutating data', () => {
  const expected = {
    id: [[2, 3, 10], [10, 3, 2]],
    created: [[2, 10, 3], [10, 2, 3]],
    status: [[3, 10, 2], [2, 10, 3]],
    total: [[2, 3, 10], [10, 3, 2]],
  };
  for (const [column, [asc, desc]] of Object.entries(expected)) {
    assert.deepEqual(sortPurchases(purchases, `${column}-asc`).map(p => p.orderId), asc);
    assert.deepEqual(sortPurchases(purchases, `${column}-desc`).map(p => p.orderId), desc);
    assert.equal(nextTableSort(`${column}-asc`, column), `${column}-desc`);
    assert.equal(nextTableSort(`${column}-desc`, column), `${column}-asc`);
  }
  assert.deepEqual(purchases.map(p => p.orderId), [10, 2, 3]);
  assert.deepEqual(sortPurchases(purchases).map(p => p.orderId), [10, 2, 3]);
});

test('ordering applies across pages and resolves ties consistently', () => {
  const many = Array.from({ length: 14 }, (_, i) => ({ orderId: i + 1,
    createdAt: 'invalid', status: 'APPROVED', totalAmount: (i + 1) * 100, items: [] }));
  assert.deepEqual(sortPurchases(many, 'total-desc').slice(0, 6).map(p => p.orderId), [14, 13, 12, 11, 10, 9]);
  assert.deepEqual(sortPurchases([...many].reverse(), 'created-desc').map(p => p.orderId), many.map(p => p.orderId));
  assert.deepEqual(sortPurchases([], 'id-asc'), []);
});
