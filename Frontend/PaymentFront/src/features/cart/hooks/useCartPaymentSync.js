import { useEffect } from 'react';
import { useAuth } from '../../auth/context/useAuth.js';
import { useCart } from '../context/useCart.js';
import { getOrderStatus, syncPayment } from '../../orders/api/orders.js';
import { CHECKOUT_STORAGE_KEY, CHECKOUT_CHANGED_EVENT, readCheckouts } from '../storage/checkouts.js';

export default function useCartPaymentSync() {
  const { isAuthenticated, customerId } = useAuth();
  const { settleCheckout } = useCart();
  useEffect(() => {
    if (!isAuthenticated || !customerId) return;
    let active = true;
    let inFlight = false;
    const lastSync = new Map();
    const controller = new AbortController();
    async function reconcile(force = false) {
      if (!active || inFlight) return;
      const entries = readCheckouts().filter(entry => entry.customerId === String(customerId));
      if (!entries.length) return;
      inFlight = true;
      try {
        for (const entry of entries) {
          if (!active) return;
          try {
            if (force || !lastSync.has(entry.orderId) || Date.now() - lastSync.get(entry.orderId) >= 30000) {
              lastSync.set(entry.orderId, Date.now());
              try { await syncPayment(entry.orderId, { signal: controller.signal }); }
              catch { /* A webhook may already have confirmed the payment. */ }
            }
            const order = await getOrderStatus(entry.orderId, { signal: controller.signal });
            if (!active) return;
            if (Number(order.idOrder) === entry.orderId && ['APPROVED', 'PAID_REQUIRES_REVIEW'].includes(order.status))
              settleCheckout(entry.orderId, customerId);
          } catch { /* Keep the receipt and cart; retry on return, reconnection or the next poll. */ }
        }
      } finally { inFlight = false; }
    }
    const refresh = () => { void reconcile(true); };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    const storageChanged = event => { if (event.key === null || event.key === CHECKOUT_STORAGE_KEY) refresh(); };
    const interval = setInterval(() => { void reconcile(); }, 10000);
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('storage', storageChanged);
    window.addEventListener(CHECKOUT_CHANGED_EVENT, refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false; controller.abort(); clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener(CHECKOUT_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [isAuthenticated, customerId, settleCheckout]);
}
