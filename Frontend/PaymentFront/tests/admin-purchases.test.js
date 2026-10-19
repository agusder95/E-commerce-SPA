import test from 'node:test';
import assert from 'node:assert/strict';
import { selectOrders, purchaseAmounts, orderStatusLabel } from '../src/features/admin/model/purchases.js';

const orders = Array.from({ length: 14 }, (_, i) => ({ idOrder: i + 1, email: `cliente${i}@correo.com`,
  status: i % 2 ? 'APPROVED' : 'PENDING_PAYMENT', datePurchase: new Date(2026, 0, i + 1).toISOString(), totalAmount: (14 - i) * 100 }));
test('admin purchases sort the whole result before showing at most six orders per page', () => {
  assert.deepEqual(selectOrders(orders).items.map(o => o.idOrder), [14, 13, 12, 11, 10, 9]);
  assert.equal(selectOrders(orders, { page: 3 }).items.length, 2);
  assert.equal(selectOrders(orders, { page: 99 }).page, 3);
  assert.deepEqual(selectOrders(orders, { sort: 'total-desc' }).items.map(o => o.idOrder), [1, 2, 3, 4, 5, 6]);
  assert.equal(orders[0].idOrder, 1);
});
test('admin purchases combine search and status filters and group legacy pending statuses', () => {
  assert.equal(selectOrders(orders, { status: 'APPROVED' }).total, 7);
  assert.equal(selectOrders(orders, { search: ' CLIENTE1@CORREO.COM ', status: 'APPROVED' }).total, 1);
  assert.equal(selectOrders([{ ...orders[0], status: 'Pending' }], { status: 'PENDING_PAYMENT' }).total, 1);
  assert.equal(selectOrders(orders, { search: 'inexistente' }).pages, 1);
  assert.equal(orderStatusLabel('APPROVED'), 'Pago aprobado');
});
test('purchase details calculate all discounts from stored order prices, including coupons', () => {
  assert.deepEqual(purchaseAmounts({ subTotal: 400, totalAmount: 270, items: [] }), { subtotal: 400, discount: 130, total: 270 });
  assert.deepEqual(purchaseAmounts({ subTotal: 0, totalAmount: 180, items: [{ originalUnitPrice: 100, finalPrice: 90, quantity: 2 }] }),
    { subtotal: 200, discount: 20, total: 180 });
});
