import test from 'node:test';
import assert from 'node:assert/strict';
import { apiErrorMessage } from '../src/shared/api/errors.js';

test('validation problems show specific field messages instead of the generic title', () => {
  assert.equal(apiErrorMessage({ title: 'One or more validation errors occurred.', errors: {
    'Items[0].Quantity': ['La cantidad debe estar entre 1 y 1000.'],
    'Items[1].Quantity': ['La cantidad debe estar entre 1 y 1000.'],
    CouponCode: ['El cupón no es válido.'],
  } }, 400), 'La cantidad debe estar entre 1 y 1000. El cupón no es válido.');
});
test('business errors and responses without validation details retain useful messages', () => {
  assert.equal(apiErrorMessage({ message: 'Stock insuficiente.' }, 400), 'Stock insuficiente.');
  assert.equal(apiErrorMessage({ Message: 'Cupón vencido.' }, 400), 'Cupón vencido.');
  assert.equal(apiErrorMessage({ title: 'Unauthorized' }, 401), 'Unauthorized');
  assert.equal(apiErrorMessage(null, 500), 'Error 500');
});
