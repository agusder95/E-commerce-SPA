import { useCallback, useContext, useSyncExternalStore } from 'react';
import { PaymentTrackingContext } from '../context/paymentTrackingContext.js';
import { EMPTY_PAYMENT } from '../services/paymentTracker.js';

export default function usePaymentOrder(orderId) {
  const tracker = useContext(PaymentTrackingContext);
  const subscribe = useCallback(listener => tracker?.subscribe(orderId, listener) ?? (() => {}), [tracker, orderId]);
  const snapshot = useCallback(() => tracker?.getSnapshot(orderId) ?? EMPTY_PAYMENT, [tracker, orderId]);
  const payment = useSyncExternalStore(subscribe, snapshot, () => EMPTY_PAYMENT);
  const resume = useCallback(until => tracker?.resume(orderId, until), [tracker, orderId]);
  return { ...payment, resume };
}
