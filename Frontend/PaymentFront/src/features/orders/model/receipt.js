import { formatDate } from '../../../shared/utils/date.js';
import { purchaseStatusLabel } from './orderStatus.js';

export function purchaseReceipt(purchase) {
  const items = purchase.items.map(item => {
    const quantity = item.quantity ?? 1;
    const unitPrice = item.finalUnitPrice ?? 0;
    const originalUnitPrice = item.originalUnitPrice ?? unitPrice;
    return { name: item.productName, type: item.productType === 'PHYSICAL' ? 'Físico' : 'Digital',
      quantity, unitPrice, originalUnitPrice, total: item.lineTotal ?? unitPrice * quantity,
      discount: Math.max(0, originalUnitPrice - unitPrice) * quantity };
  });
  const subtotal = purchase.subtotal ?? items.reduce((sum, item) => sum + item.originalUnitPrice * item.quantity, 0);
  const total = purchase.totalAmount ?? items.reduce((sum, item) => sum + item.total, 0);
  return { orderId: purchase.orderId, date: formatDate(purchase.createdAt) || 'Sin fecha',
    status: purchaseStatusLabel(purchase.status), items, subtotal, total,
    discount: purchase.discountAmount ?? Math.max(0, subtotal - total), coupon: purchase.couponCodeUsed || null,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0) };
}
