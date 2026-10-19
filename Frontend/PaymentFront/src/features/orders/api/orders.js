import { apiFetch } from '../../../shared/api/client';

export const getDownload = (id, file = 0) => apiFetch(`/api/orders/items/${id}/download?file=${file}`);

export function createOrder(orderData) {
  return apiFetch("/api/checkout/create-order", {
    method: "POST",
    body: JSON.stringify(orderData),
  });
}

export function getMyPurchases(options) {
  return apiFetch("/api/orders/my-purchases", options);
}

export function getMyPendingPurchases(options) {
  return apiFetch("/api/orders/my-purchases-pending", options);
}

export function getOrderStatus(orderId, options) {
  return apiFetch(`/api/Order/${orderId}`, options);
}

export function syncPayment(orderId, options = {}) {
  return apiFetch(`/api/checkout/orders/${orderId}/sync-payment`, {
    ...options, method: 'POST',
  });
}
