import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_ROLES, CUSTOMER_ROLES, hasRouteAccess, readTokenClaims, tokenRole } from '../src/features/auth/model/access.js';

test('visitors cannot access any private page even with a role value', () => {
  for (const allowedRoles of [CUSTOMER_ROLES, ADMIN_ROLES]) {
    assert.equal(hasRouteAccess({ isAuthenticated: false, role: 'Admin' }, allowedRoles), false);
  }
});

test('customers access shopping pages but never administration', () => {
  for (const role of ['Customer', 'CUSTOMER', ' customer ']) {
    assert.equal(hasRouteAccess({ isAuthenticated: true, role }, CUSTOMER_ROLES), true);
    assert.equal(hasRouteAccess({ isAuthenticated: true, role }, ADMIN_ROLES), false);
  }
});

test('admins access both administration and shopping pages', () => {
  for (const role of ['Admin', 'ADMIN', 'admin']) {
    assert.equal(hasRouteAccess({ isAuthenticated: true, role }, CUSTOMER_ROLES), true);
    assert.equal(hasRouteAccess({ isAuthenticated: true, role }, ADMIN_ROLES), true);
  }
});

test('missing, unknown and malformed roles fail closed', () => {
  assert.equal(hasRouteAccess({ isAuthenticated: true, role: 'Admin' }), false);
  for (const role of [null, undefined, '', 'Editor', 'Customer,Admin', ['Admin'], {}]) {
    for (const allowedRoles of [CUSTOMER_ROLES, ADMIN_ROLES]) {
      assert.equal(hasRouteAccess({ isAuthenticated: true, role }, allowedRoles), false);
    }
  }
});

test('JWT payloads support base64url, Unicode and both role claim names', () => {
  const claims = { role: 'Customer', name: 'José 🛍️' };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  assert.deepEqual(readTokenClaims(`header.${payload}.signature`), claims);
  assert.equal(tokenRole(claims), 'Customer');
  assert.equal(tokenRole({ 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Admin' }), 'Admin');
  assert.equal(tokenRole({ role: ['Admin'] }), null);
});

test('invalid stored tokens are not treated as authenticated sessions', () => {
  for (const token of [null, '', 'not-a-token', 'a.!.b', 'a.e30', 'a.bnVsbA.b', 'a.W10.b']) {
    assert.equal(readTokenClaims(token), null);
  }
});
