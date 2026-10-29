export const newCartEntryId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export const identifyCartEntries = cart => cart.map(item => typeof item.cartEntryId === 'string' && item.cartEntryId
  ? item : { ...item, cartEntryId: newCartEntryId() });

export function removePurchasedItems(cart, checkout) {
  return cart.flatMap(item => {
    const purchased = checkout.items.find(entry => entry.id === item.id && entry.cartEntryId === item.cartEntryId);
    const settled = Array.isArray(item.settledOrderIds) ? item.settledOrderIds : [];
    if (!purchased || settled.includes(checkout.orderId)) return [item];
    const quantity = item.quantity - purchased.quantity;
    return quantity > 0 ? [{ ...item, quantity, settledOrderIds: [...settled, checkout.orderId] }] : [];
  });
}
