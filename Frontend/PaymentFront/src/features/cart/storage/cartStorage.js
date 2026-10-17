export const CART_STORAGE_KEY = 'paymentfront.cart';

export function readStoredCart(storage) {
  try {
    const items = JSON.parse((storage ?? globalThis.localStorage).getItem(CART_STORAGE_KEY));
    if (!Array.isArray(items)) return [];
    const ids = new Set();
    return items.filter(item => {
      const valid = item && Number.isSafeInteger(item.id) && item.id > 0 &&
        typeof item.name === 'string' && Number.isFinite(item.price) && item.price >= 0 &&
        ['PHYSICAL', 'DIGITAL'].includes(item.type) &&
        Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
        (item.type !== 'PHYSICAL' || (Number.isSafeInteger(item.stock) && item.stock >= 0));
      if (!valid || ids.has(item.id)) return false;
      ids.add(item.id);
      return true;
    }).map(item => item.type === 'DIGITAL' ? { ...item, quantity: 1 } : item);
  } catch {
    return [];
  }
}

export function saveStoredCart(cart, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    if (cart.length) target.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    else target.removeItem(CART_STORAGE_KEY);
    return true;
  } catch {
    // The in-memory cart still works when browser storage is unavailable or full.
    return false;
  }
}
