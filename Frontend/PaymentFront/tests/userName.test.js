import test from 'node:test';
import assert from 'node:assert/strict';
import { userNameFromEmail } from '../src/features/auth/model/userName.js';

test('header names stop at the first number, symbol or email separator', () => {
  for (const email of ['martin.perez@example.com', 'martin1939perez@example.com', 'martin-perez@example.com',
    'martin_perez@example.com', 'martin+perez@example.com', 'martin@example.com']) {
    assert.equal(userNameFromEmail(email), 'martin');
  }
});

test('header names preserve letters with accents and ignore surrounding spaces', () => {
  assert.equal(userNameFromEmail(' Jose\u0301.perez@example.com '), 'José');
  assert.equal(userNameFromEmail('iñaki123@example.com'), 'iñaki');
});

test('missing emails or local parts starting with non-letters do not invent a name', () => {
  for (const email of [null, undefined, '', '  ', 123, '@example.com', '1939martin@example.com', '_martin@example.com']) {
    assert.equal(userNameFromEmail(email), '');
  }
});
