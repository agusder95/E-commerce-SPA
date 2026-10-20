import { compareTableValues, dateSortValue } from '../../../shared/utils/tableSort.js';
import { purchaseStatusLabel } from './orderStatus.js';
import { purchaseReceipt } from './receipt.js';

export function sortPurchases(purchases, sort = 'created-desc') {
  const [column, direction] = sort.split('-');
  const value = purchase => {
    switch (column) {
      case 'id': return Number(purchase.orderId);
      case 'status': return purchaseStatusLabel(purchase.status);
      case 'total': return purchaseReceipt(purchase).total;
      default: return dateSortValue(purchase.createdAt);
    }
  };
  return purchases.map(purchase => ({ purchase, value: value(purchase) }))
    .sort((a, b) => compareTableValues(a.value, b.value, direction)
      || Number(a.purchase.orderId) - Number(b.purchase.orderId))
    .map(({ purchase }) => purchase);
}
