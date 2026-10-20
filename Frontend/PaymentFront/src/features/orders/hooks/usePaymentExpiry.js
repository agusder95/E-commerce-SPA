import { useCallback, useSyncExternalStore } from 'react';

export default function usePaymentExpiry(expiresAt) {
  const subscribe = useCallback(listener => {
    const remaining = expiresAt - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return () => {};
    const timer = setTimeout(listener, Math.min(remaining, 2147483647));
    return () => clearTimeout(timer);
  }, [expiresAt]);
  const snapshot = useCallback(() => !Number.isFinite(expiresAt) || expiresAt <= Date.now(), [expiresAt]);
  return useSyncExternalStore(subscribe, snapshot, () => true);
}
