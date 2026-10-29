import { useEffect, useRef, useState } from 'react';

const WAIT_MS = 30_000;

export default function usePaymentReopenCooldown() {
  const [deadline, setDeadline] = useState(() => Date.now() + WAIT_MS);
  const deadlineRef = useRef(deadline);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const update = () => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) clearInterval(timer);
    };
    const timer = setInterval(update, 1000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [deadline]);

  function tryRestart() {
    const current = Date.now();
    if (current < deadlineRef.current) return false;
    // Lock synchronously so repeated clicks cannot open multiple tabs before React renders.
    deadlineRef.current = current + WAIT_MS;
    setNow(current);
    setDeadline(deadlineRef.current);
    return true;
  }

  return { secondsRemaining: Math.max(0, Math.ceil((deadline - now) / 1000)), tryRestart };
}
