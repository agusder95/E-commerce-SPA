import test from 'node:test';
import assert from 'node:assert/strict';
import { returnOrderId } from '../src/features/orders/model/orderStatus.js';

test('payment return only identifies the order; payment ID and status never authorize it', () => {
  assert.equal(returnOrderId(new URLSearchParams('orderId=4&payment_id=183210206627&status=approved')), '4');
  assert.equal(returnOrderId(new URLSearchParams('external_reference=4&collection_id=183210206627&collection_status=approved')), '4');
  assert.equal(returnOrderId(new URLSearchParams('status=approved&payment_id=123')), null);
});

test('invalid return IDs cannot become API paths or verified payment IDs', () => {
  for (const invalid of ['null', 'undefined', '-1', '0', '1.5', '../orders', '1&admin=true', '2147483648', '9007199254740993']) {
    assert.equal(returnOrderId(new URLSearchParams({ orderId: invalid })), null);
  }
});
