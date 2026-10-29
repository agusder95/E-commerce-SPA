import test from 'node:test';
import assert from 'node:assert/strict';
import { isTerminalStatus, paymentMessage, paymentTitle } from '../src/features/orders/model/orderStatus.js';

test('payment tracking distinguishes pending and processing from terminal server states', () => {
  for (const status of [undefined, 'PENDING_PAYMENT', 'PAYMENT_PROCESSING']) assert.equal(isTerminalStatus(status), false);
  assert.equal(paymentTitle('PENDING_PAYMENT'), 'Esperando tu pago');
  assert.equal(paymentTitle('PAYMENT_PROCESSING'), 'Pago en proceso');
  assert.match(paymentMessage('PENDING_PAYMENT'), /pestaña de Mercado Pago/);
  assert.match(paymentMessage('PAYMENT_PROCESSING'), /procesando/);
  for (const [status, title] of [['APPROVED', 'Pago aprobado'], ['REJECTED', 'Pago rechazado'],
    ['CANCELLED', 'Pago cancelado'], ['PAID_REQUIRES_REVIEW', 'Pago recibido']]) {
    assert.equal(isTerminalStatus(status), true);
    assert.equal(paymentTitle(status), title);
  }
});
