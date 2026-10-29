import { createContext, useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { availableStock } from "../model/stock.js";
import { CART_STORAGE_KEY, readStoredCart, saveStoredCart } from "../storage/cartStorage.js";
import { identifyCartEntries, newCartEntryId, removePurchasedItems } from '../model/purchasedItems.js';
import { readCheckouts, forgetCheckout } from '../storage/checkouts.js';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => identifyCartEntries(readStoredCart()));
  const latest = useRef(cart);

  useLayoutEffect(() => {
    latest.current = cart;
    saveStoredCart(cart);
  }, [cart]);

  useEffect(() => {
    function changed(event) {
      if (event.storageArea !== localStorage || (event.key !== null && event.key !== CART_STORAGE_KEY)) return;
      const next = identifyCartEntries(readStoredCart());
      latest.current = next; setCart(next);
    }
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);

  const settleCheckout = useCallback((orderId, customerId) => {
    const checkout = readCheckouts().find(entry => entry.orderId === Number(orderId) && entry.customerId === String(customerId));
    if (!checkout) return;
    let current = latest.current;
    try { localStorage.getItem(CART_STORAGE_KEY); current = readStoredCart(); } catch { /* Use the current cart if storage is unavailable. */ }
    const next = removePurchasedItems(current, checkout);
    // Persist the idempotent cart change before removing the pending receipt.
    latest.current = next;
    const persisted = saveStoredCart(next);
    setCart(next);
    if (persisted) forgetCheckout(orderId, customerId);
  }, []);

  const addToCart = useCallback((product) => {
    setCart((prev) => {
      if (product.type === "PHYSICAL" && availableStock(product, prev) <= 0) return prev;
      const existing = prev.find((item) => item.id === product.id);
      if (existing && product.type === "DIGITAL") return prev;
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, ...product, cartEntryId: item.cartEntryId, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1, cartEntryId: newCartEntryId() }];
    });
  }, []);

  const increment = useCallback((id) => {
    setCart((prev) =>
      prev.map((item) => item.id === id && item.type === "PHYSICAL" && item.quantity < item.stock
        ? { ...item, quantity: item.quantity + 1 } : item)
    );
  }, []);

  const decrement = useCallback((id) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id && item.type === "PHYSICAL" ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item
      )
    );
  }, []);

  const remove = useCallback((id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    saveStoredCart([]);
    setCart([]);
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const getAvailableStock = useCallback((product) => availableStock(product, cart), [cart]);

  return (
    <CartContext.Provider value={{ cart, addToCart, increment, decrement, remove, clearCart, settleCheckout, cartCount, getAvailableStock }}>
      {children}
    </CartContext.Provider>
  );
}

export { CartContext };
