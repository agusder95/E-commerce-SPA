export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;
export const LAST_ACTIVITY_KEY = 'session.lastActivity';
export const SESSION_CHANGED_EVENT = 'session-changed';

export function clearStoredSession(storage = globalThis.localStorage) {
  storage.removeItem('token');
  storage.removeItem('email');
  storage.removeItem(LAST_ACTIVITY_KEY);
  globalThis.window?.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function readStoredSession(storage = globalThis.localStorage, now = Date.now()) {
  const token = storage.getItem('token');
  if (!token) return null;
  const storedActivity = storage.getItem(LAST_ACTIVITY_KEY);
  // Existing sessions start tracking once; subsequent reloads preserve this time.
  const lastActivity = storedActivity === null ? now : Number(storedActivity);
  if (!Number.isFinite(lastActivity) || lastActivity <= 0 || lastActivity > now ||
      now - lastActivity >= SESSION_IDLE_MS) {
    clearStoredSession(storage);
    return null;
  }
  if (storedActivity === null) storage.setItem(LAST_ACTIVITY_KEY, String(lastActivity));
  return { token, email: storage.getItem('email'), lastActivity };
}

export function saveStoredSession(token, email, storage = globalThis.localStorage, now = Date.now()) {
  storage.setItem('token', token);
  if (email) storage.setItem('email', email);
  else storage.removeItem('email');
  storage.setItem(LAST_ACTIVITY_KEY, String(now));
}

export function recordSessionActivity(storage = globalThis.localStorage, now = Date.now()) {
  const session = readStoredSession(storage, now);
  if (session) storage.setItem(LAST_ACTIVITY_KEY, String(now));
  return session;
}
