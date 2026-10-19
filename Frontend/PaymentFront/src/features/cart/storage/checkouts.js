export const CHECKOUT_STORAGE_KEY = 'paymentfront.checkouts';
export const CHECKOUT_CHANGED_EVENT = 'paymentfront:checkouts-changed';
let fallbackRecords = null;

export function readCheckouts(storage) {
  try {
    if (storage === undefined && fallbackRecords !== null) return fallbackRecords;
    const entries = JSON.parse((storage ?? globalThis.localStorage).getItem(CHECKOUT_STORAGE_KEY));
    if (!Array.isArray(entries)) return [];
    return entries.filter(entry => entry && Number.isSafeInteger(entry.orderId) && entry.orderId > 0 &&
      /^\d+$/.test(entry.customerId) && Number(entry.customerId) > 0 && Array.isArray(entry.items) && entry.items.length > 0 &&
      entry.items.every(item => Number.isSafeInteger(item.id) && item.id > 0 && Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
        typeof item.cartEntryId === 'string' && item.cartEntryId.length > 0));
  } catch { return []; }
}

function saveCheckouts(entries, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    if (entries.length) target.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(entries));
    else target.removeItem(CHECKOUT_STORAGE_KEY);
    if (storage === undefined) fallbackRecords = null;
  } catch { if (storage === undefined) fallbackRecords = entries; }
  globalThis.window?.dispatchEvent(new Event(CHECKOUT_CHANGED_EVENT));
}

export function trackCheckout(orderId, customerId, cart, storage) {
  if (!Number.isSafeInteger(Number(orderId)) || Number(orderId) <= 0 || !/^\d+$/.test(String(customerId)) || Number(customerId) <= 0 ||
      !cart.length || cart.some(item => !item.cartEntryId)) return false;
  const entry = { orderId: Number(orderId), customerId: String(customerId),
    items: cart.map(item => ({ id: item.id, quantity: item.quantity, cartEntryId: item.cartEntryId })) };
  const previous = readCheckouts(storage);
  if (previous.some(record => record.orderId === entry.orderId && record.customerId === entry.customerId)) return true;
  saveCheckouts([...previous, entry], storage);
  return true;
}

export function forgetCheckout(orderId, customerId, storage) {
  saveCheckouts(readCheckouts(storage).filter(entry => entry.orderId !== Number(orderId) || entry.customerId !== String(customerId)), storage);
}
