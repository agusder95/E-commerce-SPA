export const ORDERS_PER_PAGE = 6;
export const ORDER_STATUS_LABELS = {
  APPROVED: 'Pago aprobado', Pending: 'Pendiente de pago', PENDING_PAYMENT: 'Pendiente de pago',
  PAYMENT_PROCESSING: 'Pago en proceso', REJECTED: 'Pago rechazado', CANCELLED: 'Cancelada',
  PAID_REQUIRES_REVIEW: 'Pago recibido: requiere revisión',
};
export const orderStatusLabel = status => ORDER_STATUS_LABELS[status] || 'Estado por revisar';
export const ORDER_SORT_OPTIONS = {
  newest: 'Más recientes primero', oldest: 'Más antiguas primero',
  'total-desc': 'Mayor importe primero', 'total-asc': 'Menor importe primero',
  'id-desc': 'Número de orden: mayor a menor', 'id-asc': 'Número de orden: menor a mayor',
};
export function selectOrders(orders, { search = '', status = '', sort = 'newest', page = 1 } = {}) {
  const query = search.trim().toLocaleLowerCase('es');
  const filtered = orders.filter(order => (!status || (status === 'PENDING_PAYMENT'
    ? ['PENDING_PAYMENT', 'Pending'].includes(order.status) : order.status === status)) &&
    `${order.idOrder} ${order.email}`.toLocaleLowerCase('es').includes(query));
  const compare = {
    newest: (a, b) => new Date(b.datePurchase) - new Date(a.datePurchase),
    oldest: (a, b) => new Date(a.datePurchase) - new Date(b.datePurchase),
    'total-desc': (a, b) => b.totalAmount - a.totalAmount,
    'total-asc': (a, b) => a.totalAmount - b.totalAmount,
    'id-desc': (a, b) => b.idOrder - a.idOrder, 'id-asc': (a, b) => a.idOrder - b.idOrder,
  }[sort] || ((a, b) => b.idOrder - a.idOrder);
  filtered.sort((a, b) => compare(a, b) || b.idOrder - a.idOrder);
  const pages = Math.max(1, Math.ceil(filtered.length / ORDERS_PER_PAGE));
  const currentPage = Math.min(pages, Math.max(1, page));
  return { items: filtered.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE),
    total: filtered.length, page: currentPage, pages };
}
export function purchaseAmounts(order) {
  const subtotal = order.subTotal > 0 ? order.subTotal : order.items.reduce((sum, item) =>
    sum + (item.originalUnitPrice ?? item.finalPrice) * item.quantity, 0);
  return { subtotal, discount: Math.max(0, subtotal - order.totalAmount), total: order.totalAmount };
}
