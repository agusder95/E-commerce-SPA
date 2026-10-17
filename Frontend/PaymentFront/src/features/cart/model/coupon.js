// A quote is valid only for the exact cart that was validated by the server.
export const couponCartKey = cart => JSON.stringify(cart.map(item =>
  [item.id, item.quantity, item.price, item.unitPrice]).sort((a, b) => a[0] - b[0]));
