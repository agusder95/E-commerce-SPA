import { isTerminalStatus } from '../model/orderStatus.js';

export const EMPTY_PAYMENT = Object.freeze({ order: null, error: '', unavailable: false, retrying: false });
const validId = id => Number.isSafeInteger(Number(id)) && Number(id) > 0;

// One tracker per authenticated session, shared by cart receipts and result-page subscribers.
// HTTP and the clock are injected so lifecycle races can be verified without real payments.
export function createPaymentTracker({ getOrderStatus, onConfirmed = () => {}, onStopped = () => {},
  onUnauthorized = () => {}, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const entries = new Map();
  let running = false;
  let available = true;

  function ensure(id) {
    id = Number(id);
    if (!entries.has(id)) entries.set(id, { id, listeners: new Set(), tracked: false, snapshot: EMPTY_PAYMENT,
      stopped: false, attempts: 0, lastRequest: null, due: now(), timer: null, controller: null, retryUntil: null });
    return entries.get(id);
  }
  function notify(entry, snapshot) {
    entry.snapshot = snapshot;
    for (const listener of entry.listeners) listener();
  }
  function cancel(entry) {
    if (entry.timer !== null) clearTimer(entry.timer);
    entry.timer = null;
    entry.controller?.abort();
    entry.controller = null;
  }
  const needed = entry => entry.tracked || entry.listeners.size > 0;
  const current = (entry, controller) => running && available && entries.get(entry.id) === entry && entry.controller === controller;

  function schedule(entry) {
    if (entry.timer !== null) clearTimer(entry.timer);
    entry.timer = null;
    if (!running || !available || !needed(entry) || entry.stopped || entry.controller) return;
    entry.timer = setTimer(() => { entry.timer = null; void poll(entry); }, Math.max(0, entry.due - now()));
  }
  function finish(entry, order) {
    entry.stopped = true;
    if (['APPROVED', 'PAID_REQUIRES_REVIEW'].includes(order.status)) onConfirmed(entry.id);
    else onStopped(entry.id);
  }
  async function poll(entry) {
    if (!running || !available || entry.stopped || entry.controller || !needed(entry)) return;
    const controller = new AbortController();
    entry.controller = controller;
    entry.lastRequest = now();
    let failed = false;
    try {
      const order = await getOrderStatus(entry.id, { signal: controller.signal });
      if (!current(entry, controller)) return;
      if (Number(order?.idOrder) !== entry.id || typeof order.status !== 'string') throw new Error('Invalid order response');
      if (entry.snapshot.order?.status !== order.status) entry.attempts = 0;
      if (order.status !== 'REJECTED') entry.retryUntil = null;
      const retrying = order.status === 'REJECTED' && entry.retryUntil > now();
      if (isTerminalStatus(order.status) && !retrying) entry.stopped = true;
      notify(entry, { order, error: '', unavailable: false, retrying });
      if (entry.stopped) finish(entry, order);
    } catch (error) {
      if (!current(entry, controller)) return;
      if (error.status === 401) {
        stop(); onUnauthorized(); return;
      }
      failed = true;
      const unavailable = error.status === 403 || error.status === 404;
      if (unavailable) entry.stopped = true;
      notify(entry, { ...entry.snapshot, unavailable, retrying: false, error: unavailable
        ? 'No encontramos este pedido o no tenés acceso.'
        : 'No pudimos actualizar el estado del pago. Volveremos a intentarlo automáticamente.' });
      if (unavailable) onStopped(entry.id);
    } finally {
      if (current(entry, controller)) {
        entry.controller = null;
        entry.attempts++;
        const delay = Math.min(3000 * 2 ** Math.min(entry.attempts - 1, 5) * (failed ? 2 : 1), failed ? 60000 : 30000);
        entry.due = now() + delay;
        schedule(entry);
      }
    }
  }
  function refresh() {
    if (!running || !available) return;
    for (const entry of entries.values()) {
      // Coalesce focus/pageshow/visibility events into a single refresh.
      entry.due = Math.max(now(), entry.lastRequest === null ? 0 : entry.lastRequest + 1000);
      schedule(entry);
    }
  }
  function stop() {
    running = false;
    for (const entry of entries.values()) cancel(entry);
  }
  return {
    start() { running = true; refresh(); },
    stop,
    refresh,
    setAvailable(value) {
      if (available === value) return;
      available = value;
      if (available) refresh();
      else for (const entry of entries.values()) cancel(entry);
    },
    setTrackedOrders(ids) {
      const tracked = new Set(ids.filter(validId).map(Number));
      for (const id of tracked) ensure(id).tracked = true;
      for (const entry of entries.values()) {
        entry.tracked = tracked.has(entry.id);
        if (!needed(entry)) { cancel(entry); entries.delete(entry.id); }
        else schedule(entry);
      }
    },
    subscribe(id, listener) {
      if (!validId(id)) return () => {};
      const entry = ensure(id);
      entry.listeners.add(listener);
      schedule(entry);
      return () => {
        entry.listeners.delete(listener);
        if (!needed(entry)) { cancel(entry); entries.delete(entry.id); }
      };
    },
    getSnapshot(id) { return entries.get(Number(id))?.snapshot ?? EMPTY_PAYMENT; },
    resume(id, until) {
      if (!validId(id) || !Number.isFinite(until) || until <= now()) return;
      const entry = ensure(id);
      cancel(entry);
      entry.stopped = false; entry.attempts = 0; entry.retryUntil = until; entry.due = now();
      notify(entry, { ...entry.snapshot, error: '', unavailable: false, retrying: true });
      schedule(entry);
    },
  };
}
