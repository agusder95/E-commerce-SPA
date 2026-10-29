import test from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_IDLE_MS, LAST_ACTIVITY_KEY, readStoredSession, saveStoredSession,
  recordSessionActivity, clearStoredSession } from '../src/shared/auth/session.js';

const now = Date.parse('2026-10-13T12:00:00Z');
function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('sessions expire at exactly twelve hours of inactivity, removing only session data', () => {
  const target = storage();
  saveStoredSession('token', 'email', target, now);
  target.setItem('paymentfront.cart', 'saved cart');
  assert.equal(SESSION_IDLE_MS, 43200000);
  assert.ok(readStoredSession(target, now + SESSION_IDLE_MS - 1));
  assert.equal(readStoredSession(target, now + SESSION_IDLE_MS), null);
  for (const key of ['token', 'email', LAST_ACTIVITY_KEY]) assert.equal(target.getItem(key), null);
  assert.equal(target.getItem('paymentfront.cart'), 'saved cart');
});

test('user activity restarts the deadline and reloads/API reads preserve the timestamp', () => {
  const target = storage();
  saveStoredSession('token', 'email', target, now);
  const activityTime = now + SESSION_IDLE_MS - 1000;
  assert.ok(recordSessionActivity(target, activityTime));
  assert.equal(readStoredSession(target, activityTime + 500).lastActivity, activityTime);
  assert.equal(target.getItem(LAST_ACTIVITY_KEY), String(activityTime));
  assert.ok(readStoredSession(target, activityTime + SESSION_IDLE_MS - 1));
  assert.equal(readStoredSession(target, activityTime + SESSION_IDLE_MS), null);
});

test('returning to an expired session cannot revive it with new activity', () => {
  const target = storage();
  saveStoredSession('token', 'email', target, now);
  assert.equal(recordSessionActivity(target, now + SESSION_IDLE_MS + 1), null);
  assert.equal(target.getItem('token'), null);
  assert.equal(target.getItem(LAST_ACTIVITY_KEY), null);
});

test('existing sessions without tracking initialize once, invalid timestamps expire', () => {
  const target = storage();
  target.setItem('token', 'legacy token');
  assert.equal(readStoredSession(target, now).lastActivity, now);
  assert.equal(readStoredSession(target, now + 1000).lastActivity, now);
  for (const value of ['invalid', '', String(now + 1)]) {
    saveStoredSession('token', 'email', target, now);
    target.setItem(LAST_ACTIVITY_KEY, value);
    assert.equal(readStoredSession(target, now), null);
  }
});

test('manual logout removes the activity timestamp and a new login starts a new deadline', () => {
  const target = storage();
  saveStoredSession('first', 'first email', target, now);
  clearStoredSession(target);
  assert.equal(readStoredSession(target, now), null);
  saveStoredSession('second', 'second email', target, now + 1000);
  assert.deepEqual(readStoredSession(target, now + 1000), { token: 'second', email: 'second email', lastActivity: now + 1000 });
});
