export function cartTotals(cart) {
  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice ?? item.price) * item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { subtotal, discount: Math.max(0, subtotal - total), total };
}
