import { createContext, useState, useEffect, useCallback } from "react";
import { readTokenClaims, tokenRole } from '../model/access.js';
import { clearStoredSession, readStoredSession, saveStoredSession, recordSessionActivity,
  SESSION_IDLE_MS, LAST_ACTIVITY_KEY, SESSION_CHANGED_EVENT } from '../../../shared/auth/session.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession());
  const token = session?.token ?? null;
  const email = session?.email ?? null;
  const claims = readTokenClaims(token);
  const role = tokenRole(claims);

  const login = useCallback((newToken, newEmail) => {
    saveStoredSession(newToken, newEmail);
    setSession(readStoredSession());
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    setSession(null);
  }, []);

  useEffect(() => {
    let timeout;
    function checkSession() {
      clearTimeout(timeout);
      const next = readStoredSession();
      setSession(previous => previous?.token === next?.token && previous?.email === next?.email ? previous : next);
      if (next) timeout = setTimeout(checkSession, Math.max(1, next.lastActivity + SESSION_IDLE_MS - Date.now()));
    }
    function activity() {
      // Check before updating so an expired session cannot be revived on return.
      if (!recordSessionActivity()) checkSession();
    }
    function storageChanged(event) {
      if (event.storageArea === localStorage &&
          (event.key === null || ['token', 'email', LAST_ACTIVITY_KEY].includes(event.key))) checkSession();
    }
    const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];
    if (token) activityEvents.forEach(event => document.addEventListener(event, activity, { passive: true, capture: true }));
    window.addEventListener('focus', checkSession);
    window.addEventListener('pageshow', checkSession);
    window.addEventListener('storage', storageChanged);
    window.addEventListener(SESSION_CHANGED_EVENT, checkSession);
    document.addEventListener('visibilitychange', checkSession);
    checkSession();
    return () => {
      clearTimeout(timeout);
      activityEvents.forEach(event => document.removeEventListener(event, activity, true));
      window.removeEventListener('focus', checkSession);
      window.removeEventListener('pageshow', checkSession);
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener(SESSION_CHANGED_EVENT, checkSession);
      document.removeEventListener('visibilitychange', checkSession);
    };
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, email, role, customerId: claims?.idCustomer, isAuthenticated: !!claims, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
