import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseReceipt } from '../src/features/orders/model/receipt.js';
import { createReceiptPdf } from '../src/features/orders/lib/receiptPdf.js';

const purchase = { orderId: 42, status: 'APPROVED', createdAt: '2026-10-16T15:00:00Z',
  subtotal: 400, discountAmount: 130, totalAmount: 270, couponCodeUsed: 'AHORRO',
  items: [{ productName: 'Guía de aves', productType: 'DIGITAL', quantity: 1, originalUnitPrice: 100, finalUnitPrice: 90, lineTotal: 90 },
    { productName: 'Colección impresa', productType: 'PHYSICAL', quantity: 2, originalUnitPrice: 150, finalUnitPrice: 90, lineTotal: 180 }] };

test('receipt preserves purchase snapshots, coupon, quantities and Spanish status', () => {
  const receipt = purchaseReceipt(purchase);
  assert.equal(receipt.status, 'Pago aprobado');
  assert.equal(receipt.date, '16/10/2026');
  assert.deepEqual([receipt.subtotal, receipt.discount, receipt.total, receipt.quantity], [400, 130, 270, 3]);
  assert.equal(receipt.coupon, 'AHORRO');
  assert.equal(receipt.items[1].discount, 120);
  assert.equal(receipt.items[1].type, 'Físico');
  assert.equal(purchaseReceipt({ ...purchase, status: 'CANCELLED' }).status, 'Compra cancelada');
  assert.equal(purchaseReceipt({ ...purchase, status: 'unknown' }).status, 'Estado por revisar');
});

test('receipt PDF is a real narrow PDF with the order and totals', () => {
  const doc = createReceiptPdf(purchase);
  const pdf = doc.output();
  assert.ok(pdf.startsWith('%PDF-'));
  assert.ok(pdf.includes('AHORRO'));
  assert.ok(pdf.includes('270,00'));
  assert.ok(pdf.includes('Compra #42'));
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 80) < 0.01);
  assert.ok(doc.internal.pageSize.getHeight() < 200);
});

test('long receipts wrap product names and paginate without dropping final totals', () => {
  const items = Array.from({ length: 70 }, (_, index) => ({ ...purchase.items[0], productName: `Producto ${index} con un nombre largo para comprobar el salto de página` }));
  const doc = createReceiptPdf({ ...purchase, items });
  assert.ok(doc.getNumberOfPages() > 1);
  const pdf = doc.output();
  assert.ok(pdf.includes('Producto 69'));
  assert.ok(pdf.includes('TOTAL:'));
  assert.ok(pdf.includes('270,00'));
});
