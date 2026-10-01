import { createContext, useState, useCallback } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const increment = useCallback((id) => {
    setCart((prev) =>
      prev.map((item) => item.id === id ? { ...item, quantity: item.quantity + 1 } : item)
    );
  }, []);

  const decrement = useCallback((id) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item
      )
    );
  }, []);

  const remove = useCallback((id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, increment, decrement, remove, clearCart, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export { CartContext };
