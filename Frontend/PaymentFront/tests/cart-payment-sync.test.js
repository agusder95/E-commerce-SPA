import test from 'node:test';
import assert from 'node:assert/strict';
import { identifyCartEntries, removePurchasedItems } from '../src/features/cart/model/purchasedItems.js';
import { CHECKOUT_STORAGE_KEY, trackCheckout, readCheckouts, forgetCheckout,
  stopCheckoutTracking, resumeCheckoutTracking } from '../src/features/cart/storage/checkouts.js';

const entry = { id: 1, type: 'PHYSICAL', quantity: 3, cartEntryId: 'first-entry' };
const checkout = { orderId: 42, customerId: '7', items: [{ id: 1, quantity: 1, cartEntryId: 'first-entry' }] };
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };

test('confirmed purchase removes only bought quantities and keeps unrelated cart items', () => {
  const other = { id: 2, quantity: 1, cartEntryId: 'other-entry' };
  const next = removePurchasedItems([entry, other], checkout);
  assert.equal(next[0].quantity, 2);
  assert.deepEqual(next[1], other);
  assert.deepEqual(removePurchasedItems(next, checkout), next);
  assert.equal(entry.quantity, 3);
});

test('removing and readding the same product while paying creates a separate entry', () => {
  const readded = { ...entry, cartEntryId: 'new-entry' };
  assert.deepEqual(removePurchasedItems([readded], checkout), [readded]);
  assert.deepEqual(removePurchasedItems([{ ...entry, quantity: 1 }], checkout), []);
  const identified = identifyCartEntries([{ id: 1 }, { id: 2, cartEntryId: 'existing' }]);
  assert.ok(identified[0].cartEntryId);
  assert.equal(identified[1].cartEntryId, 'existing');
  assert.equal(identifyCartEntries(identified)[0].cartEntryId, identified[0].cartEntryId);
});

test('pending order snapshots survive reload, stay immutable and are scoped to the account', () => {
  const local = storage();
  trackCheckout(42, 7, [entry], local);
  trackCheckout(43, 8, [entry], local);
  trackCheckout(42, 7, [{ ...entry, quantity: 9 }], local);
  assert.equal(readCheckouts(local).length, 2);
  assert.equal(readCheckouts(local)[0].items[0].quantity, 3);
  forgetCheckout(42, 8, local);
  assert.equal(readCheckouts(local).length, 2);
  forgetCheckout(42, 7, local);
  assert.equal(readCheckouts(local)[0].customerId, '8');
  forgetCheckout(43, 8, local);
  assert.equal(local.getItem(CHECKOUT_STORAGE_KEY), null);
});

test('invalid or unavailable storage and unowned checkout records are ignored', () => {
  const local = storage();
  for (const value of ['invalid', '{}', '[null]', '[{"orderId":42,"customerId":"7","items":[]}]']) {
    local.setItem(CHECKOUT_STORAGE_KEY, value);
    assert.deepEqual(readCheckouts(local), []);
  }
  assert.equal(trackCheckout(42, undefined, [entry], local), false);
  assert.deepEqual(readCheckouts({ getItem() { throw new Error('disabled'); } }), []);
});

test('terminal orders stop tracking without losing the immutable snapshot needed for a late approval', () => {
  const local = storage();
  trackCheckout(42, 7, [entry], local);
  trackCheckout(43, 8, [entry], local);
  stopCheckoutTracking(42, 8, local);
  assert.equal(readCheckouts(local)[0].trackingStopped, undefined);
  stopCheckoutTracking(42, 7, local);
  const stopped = readCheckouts(local)[0];
  assert.equal(stopped.trackingStopped, true);
  assert.equal(stopped.items[0].quantity, 3);
  assert.deepEqual(removePurchasedItems([entry], stopped), []);
  resumeCheckoutTracking(42, 7, local);
  assert.equal(readCheckouts(local)[0].trackingStopped, false);
  assert.equal(readCheckouts(local)[1].customerId, '8');
});
