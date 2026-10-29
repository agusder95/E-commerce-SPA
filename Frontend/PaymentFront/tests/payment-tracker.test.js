import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentTracker } from '../src/features/orders/services/paymentTracker.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const pending = id => ({ idOrder: id, status: 'PENDING_PAYMENT' });
function clock() {
  let time = 0;
  let sequence = 0;
  const timers = new Map();
  return {
    now: () => time,
    setTimer: (callback, delay) => { const id = ++sequence; timers.set(id, { at: time + delay, callback }); return id; },
    clearTimer: id => timers.delete(id),
    count: () => timers.size,
    async advance(ms) {
      const target = time + ms;
      for (let turns = 0; turns < 1000; turns++) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) { time = target; await flush(); return; }
        time = next[1].at; timers.delete(next[0]); next[1].callback(); await flush();
      }
      throw new Error('Runaway polling');
    },
  };
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('no orders creates no requests or timers; cart and result share one progressive status request', async () => {
  const time = clock(); const calls = []; let status = 'PENDING_PAYMENT'; let confirmed = 0;
  const tracker = createPaymentTracker({ ...time, getOrderStatus: async id => {
    calls.push({ id, at: time.now() }); return { idOrder: id, status };
  }, onConfirmed: () => confirmed++ });
  tracker.start(); await time.advance(60000);
  assert.deepEqual(calls, []); assert.equal(time.count(), 0);
  tracker.setTrackedOrders([42, 42]);
  let resultChanges = 0;
  const unsubscribe = tracker.subscribe('42', () => resultChanges++);
  tracker.subscribe(42, () => {});
  // React StrictMode can stop and restart effects before the first scheduled request.
  tracker.stop(); tracker.start();
  await time.advance(105000);
  assert.deepEqual(calls.map(call => call.at - 60000), [0, 3000, 9000, 21000, 45000, 75000, 105000]);
  status = 'APPROVED'; await time.advance(30000);
  assert.equal(confirmed, 1); assert.equal(tracker.getSnapshot(42).order.status, 'APPROVED');
  assert.equal(resultChanges, 8); assert.equal(time.count(), 0);
  await time.advance(600000); assert.equal(calls.length, 8);
  unsubscribe(); tracker.stop();
});

test('hidden/offline tracking aborts requests and ignores late responses, then coalesces return events', async () => {
  const time = clock(); const blocked = deferred(); const calls = []; let confirmed = 0;
  const tracker = createPaymentTracker({ ...time, getOrderStatus: (id, { signal }) => {
    calls.push({ id, signal }); return calls.length === 1 ? blocked.promise : Promise.resolve(pending(id));
  }, onConfirmed: () => confirmed++ });
  tracker.setTrackedOrders([42]); tracker.start(); await time.advance(0);
  tracker.setAvailable(false);
  assert.equal(calls[0].signal.aborted, true);
  blocked.resolve({ idOrder: 42, status: 'APPROVED' }); await flush();
  assert.equal(confirmed, 0); assert.equal(tracker.getSnapshot(42).order, null);
  await time.advance(600000); assert.equal(calls.length, 1); assert.equal(time.count(), 0);
  tracker.setAvailable(true); tracker.refresh(); tracker.refresh(); await time.advance(0);
  assert.equal(calls.length, 2);
  tracker.refresh(); tracker.refresh(); await time.advance(999); assert.equal(calls.length, 2);
  await time.advance(1); assert.equal(calls.length, 3);
  tracker.stop();
});

test('logout cancels in-flight work and an old session cannot publish into a new tracker', async () => {
  const time = clock(); const blocked = deferred(); let oldConfirmations = 0; let oldSignal;
  const old = createPaymentTracker({ ...time, getOrderStatus: (_, { signal }) => { oldSignal = signal; return blocked.promise; },
    onConfirmed: () => oldConfirmations++ });
  old.setTrackedOrders([42]); old.start(); await time.advance(0); old.stop();
  const calls = [];
  const next = createPaymentTracker({ ...time, getOrderStatus: async id => { calls.push(id); return pending(id); } });
  next.start(); blocked.resolve({ idOrder: 42, status: 'APPROVED' }); await flush();
  await time.advance(60000);
  assert.equal(oldSignal.aborted, true); assert.equal(oldConfirmations, 0); assert.deepEqual(calls, []);
  next.setTrackedOrders([99]); await time.advance(0); assert.deepEqual(calls, [99]);
  next.stop();
});

test('401 stops the session; 403/404 stop only the inaccessible order without confirming a purchase', async () => {
  for (const status of [401, 403, 404]) {
    const time = clock(); let requests = 0; let unauthorized = 0; let stopped = 0; let confirmed = 0;
    const tracker = createPaymentTracker({ ...time, getOrderStatus: async () => { requests++; throw { status }; },
      onUnauthorized: () => unauthorized++, onStopped: () => stopped++, onConfirmed: () => confirmed++ });
    tracker.setTrackedOrders([42]); tracker.start(); await time.advance(600000);
    assert.equal(requests, 1); assert.equal(confirmed, 0); assert.equal(time.count(), 0);
    assert.equal(unauthorized, status === 401 ? 1 : 0); assert.equal(stopped, status === 401 ? 0 : 1);
    if (status !== 401) assert.equal(tracker.getSnapshot(42).unavailable, true);
    tracker.stop();
  }
});

test('network failures back off, never overlap, and successful server states clear the error', async () => {
  const time = clock(); const calls = []; let failing = true;
  const tracker = createPaymentTracker({ ...time, getOrderStatus: async id => {
    calls.push(time.now()); if (failing) throw new Error('offline'); return pending(id);
  } });
  tracker.setTrackedOrders([42]); tracker.start(); await time.advance(42000);
  assert.deepEqual(calls, [0, 6000, 18000, 42000]);
  assert.match(tracker.getSnapshot(42).error, /automáticamente/);
  failing = false; await time.advance(48000);
  assert.equal(tracker.getSnapshot(42).error, ''); assert.equal(tracker.getSnapshot(42).order.status, 'PENDING_PAYMENT');
  tracker.stop();
});

test('removing all consumers aborts an outstanding read and prevents its cart side effects', async () => {
  const time = clock(); const blocked = deferred(); let signal; let confirmed = 0;
  const tracker = createPaymentTracker({ ...time, getOrderStatus: (_, options) => { signal = options.signal; return blocked.promise; },
    onConfirmed: () => confirmed++ });
  tracker.setTrackedOrders([42]); const unsubscribe = tracker.subscribe(42, () => {});
  tracker.start(); await time.advance(0);
  tracker.setTrackedOrders([]); assert.equal(signal.aborted, false);
  unsubscribe(); assert.equal(signal.aborted, true);
  blocked.resolve({ idOrder: 42, status: 'APPROVED' }); await flush();
  assert.equal(confirmed, 0); assert.equal(time.count(), 0); tracker.stop();
});

test('rejected/cancelled/review orders stop automatic polling and malformed responses cannot settle the cart', async () => {
  for (const status of ['REJECTED', 'CANCELLED', 'PAID_REQUIRES_REVIEW']) {
    const time = clock(); let requests = 0; const confirmations = []; const stopped = [];
    const tracker = createPaymentTracker({ ...time, getOrderStatus: async id => { requests++; return { idOrder: id, status }; },
      onConfirmed: id => confirmations.push(id), onStopped: id => stopped.push(id) });
    tracker.setTrackedOrders([42]); tracker.start(); await time.advance(600000);
    assert.equal(requests, 1);
    assert.deepEqual(confirmations, status === 'PAID_REQUIRES_REVIEW' ? [42] : []);
    assert.deepEqual(stopped, status === 'PAID_REQUIRES_REVIEW' ? [] : [42]); tracker.stop();
  }
  const time = clock(); let confirmed = 0;
  const tracker = createPaymentTracker({ ...time, getOrderStatus: async () => ({ idOrder: 99, status: 'APPROVED' }),
    onConfirmed: () => confirmed++ });
  tracker.setTrackedOrders([42]); tracker.start(); await time.advance(0);
  assert.equal(confirmed, 0); assert.match(tracker.getSnapshot(42).error, /actualizar/); tracker.stop();
});

test('explicit retry keeps observing an earlier rejection until payment changes or the preference expires', async () => {
  const time = clock(); let status = 'REJECTED'; let requests = 0; let confirmed = 0;
  const tracker = createPaymentTracker({ ...time, getOrderStatus: async id => { requests++; return { idOrder: id, status }; },
    onConfirmed: () => confirmed++ });
  tracker.subscribe(42, () => {}); tracker.start(); await time.advance(0);
  assert.equal(time.count(), 0);
  tracker.resume(42, 20000); await time.advance(0);
  assert.equal(tracker.getSnapshot(42).retrying, true); assert.equal(requests, 2);
  await time.advance(3000); assert.equal(requests, 3);
  status = 'PAYMENT_PROCESSING'; await time.advance(6000);
  assert.equal(tracker.getSnapshot(42).retrying, false);
  status = 'APPROVED'; await time.advance(3000); assert.equal(confirmed, 1);
  tracker.stop();

  const expired = createPaymentTracker({ ...time, getOrderStatus: async id => ({ idOrder: id, status: 'REJECTED' }) });
  expired.subscribe(43, () => {}); expired.start(); await time.advance(0);
  expired.resume(43, time.now() + 1000); await time.advance(3000);
  assert.equal(expired.getSnapshot(43).retrying, false); assert.equal(time.count(), 0); expired.stop();
});

test('live status waits for a database notification without delaying the next read or creating parallel requests', async () => {
  const time = clock(); const waiting = deferred(); let reads = 0; let confirmed = 0;
  const tracker = createPaymentTracker({ ...time, getOrderStatus: async (id, options) => {
    reads++;
    if (reads === 1) return { ...pending(id), live: true };
    assert.equal(options.knownStatus, 'PENDING_PAYMENT');
    return waiting.promise;
  }, onConfirmed: () => confirmed++ });
  tracker.setTrackedOrders([42]); tracker.subscribe(42, () => {}); tracker.start();
  await time.advance(0);
  assert.equal(reads, 2); assert.equal(time.count(), 0);
  await time.advance(30000); assert.equal(reads, 2);
  waiting.resolve({ idOrder: 42, status: 'APPROVED', live: true }); await flush();
  assert.equal(confirmed, 1); assert.equal(tracker.getSnapshot(42).order.status, 'APPROVED');
  assert.equal(time.count(), 0); tracker.stop();
});
