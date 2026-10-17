import { apiFetch } from '../../../shared/api/client.js';

export const validateCoupon = (couponCode, cart, options) => apiFetch('/api/checkout/validate-coupon', {
  ...options, method: 'POST', body: JSON.stringify({ couponCode,
    items: cart.map(item => ({ idProduct: item.id, quantity: item.quantity })) }),
});
