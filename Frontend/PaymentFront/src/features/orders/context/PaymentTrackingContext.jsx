import { useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/context/useAuth.js';
import { useCart } from '../../cart/context/useCart.js';
import { CHECKOUT_STORAGE_KEY, CHECKOUT_CHANGED_EVENT, readCheckouts, stopCheckoutTracking } from '../../cart/storage/checkouts.js';
import { getOrderStatus } from '../api/orders.js';
import { createPaymentTracker } from '../services/paymentTracker.js';
import { readStoredSession } from '../../../shared/auth/session.js';
import { PaymentTrackingContext } from './paymentTrackingContext.js';

export function PaymentTrackingProvider({ children }) {
  const { isAuthenticated, customerId, token, logout } = useAuth();
  const { settleCheckout } = useCart();
  const tracker = useMemo(() => !isAuthenticated || !customerId ? null : createPaymentTracker({
    getOrderStatus,
    onConfirmed: id => { if (readStoredSession()?.token === token) settleCheckout(id, customerId); },
    onStopped: id => { if (readStoredSession()?.token === token) stopCheckoutTracking(id, customerId); },
    onUnauthorized: () => { if (readStoredSession()?.token === token) logout(); },
  }), [isAuthenticated, customerId, token, settleCheckout, logout]);

  useEffect(() => {
    if (!tracker) return;
    const loadReceipts = () => tracker.setTrackedOrders(readCheckouts()
      .filter(entry => entry.customerId === String(customerId) && !entry.trackingStopped).map(entry => entry.orderId));
    const availability = () => tracker.setAvailable(document.visibilityState !== 'hidden' && navigator.onLine !== false);
    const refresh = () => { availability(); tracker.refresh(); };
    const storageChanged = event => { if (event.key === null || event.key === CHECKOUT_STORAGE_KEY) loadReceipts(); };
    availability();
    loadReceipts();
    tracker.start();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', availability);
    window.addEventListener('storage', storageChanged);
    window.addEventListener(CHECKOUT_CHANGED_EVENT, loadReceipts);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      tracker.stop();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', availability);
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener(CHECKOUT_CHANGED_EVENT, loadReceipts);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [tracker, customerId]);

  return <PaymentTrackingContext.Provider value={tracker}>{children}</PaymentTrackingContext.Provider>;
}

