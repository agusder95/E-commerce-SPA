import test from 'node:test';
import assert from 'node:assert/strict';
import { availableStock, unavailableCartProducts } from '../src/features/cart/model/stock.js';
import { CART_STORAGE_KEY, readStoredCart, saveStoredCart } from '../src/features/cart/storage/cartStorage.js';
import { cartTotals } from '../src/features/cart/model/totals.js';

const product = { id: 1, type: 'PHYSICAL', stock: 3 };

test('checkout removes sold-out physical products using server stock, without mistaking cart reservations for sold-out stock', () => {
  const cart = [{ id: 1, type: 'PHYSICAL', stock: 5, quantity: 1 },
    { id: 2, type: 'PHYSICAL', stock: 1, quantity: 1 }, { id: 3, type: 'DIGITAL', stock: 0, quantity: 1 },
    { id: 4, type: 'PHYSICAL', stock: 2, quantity: 1 }];
  assert.deepEqual(unavailableCartProducts(cart, [{ id: 1, stock: 0 }, { id: 2, stock: 1 }, { id: 3, stock: 0 }]).map(p => p.id), [1, 4]);
  assert.equal(availableStock(cart[1], cart), 0);
  assert.deepEqual(unavailableCartProducts([cart[1]], [{ id: 2, stock: 1 }]), []);
});

test('physical stock discounts only units of the same product in the local cart', () => {
  assert.equal(availableStock(product, []), 3);
  assert.equal(availableStock(product, [{ id: 1, quantity: 1 }, { id: 2, quantity: 5 }]), 2);
  assert.equal(availableStock(product, [{ id: 1, quantity: 3 }]), 0);
  assert.equal(availableStock(product, [{ id: 1, quantity: 4 }]), 0);
  assert.equal(product.stock, 3);
});

test('reducing, removing or clearing cart units restores their local availability', () => {
  assert.equal(availableStock(product, [{ id: 1, quantity: 2 }]), 1);
  assert.equal(availableStock(product, [{ id: 1, quantity: 1 }]), 2);
  assert.equal(availableStock(product, [{ id: 2, quantity: 1 }]), 3);
  assert.equal(availableStock(product, []), 3);
});

test('digital products do not reserve physical stock', () => {
  assert.equal(availableStock({ id: 1, type: 'DIGITAL', stock: 0 }, [{ id: 1, quantity: 5 }]), 0);
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('persisted products and quantities survive reload and reserve stock', () => {
  const storage = memoryStorage();
  const cart = [{ ...product, name: 'Libro', price: 100, quantity: 2 }];
  saveStoredCart(cart, storage);
  const restored = readStoredCart(storage);
  assert.deepEqual(restored, cart);
  assert.equal(availableStock(product, restored), 1);
  saveStoredCart([{ ...cart[0], quantity: 1 }], storage);
  assert.equal(availableStock(product, readStoredCart(storage)), 2);
});

test('clearing a confirmed purchase removes stored products and restores an empty cart', () => {
  const storage = memoryStorage();
  saveStoredCart([{ ...product, name: 'Libro', price: 100, quantity: 2 }], storage);
  saveStoredCart([], storage);
  assert.equal(storage.getItem(CART_STORAGE_KEY), null);
  assert.deepEqual(readStoredCart(storage), []);
});

test('invalid stored data and unavailable storage do not prevent using the cart', () => {
  const storage = memoryStorage();
  for (const value of ['invalid json', '{}', 'null']) {
    storage.setItem(CART_STORAGE_KEY, value);
    assert.deepEqual(readStoredCart(storage), []);
  }
  const item = { ...product, name: 'Libro', price: 100, quantity: 1 };
  storage.setItem(CART_STORAGE_KEY, JSON.stringify([null, item, { ...item, quantity: -1 }, item]));
  assert.deepEqual(readStoredCart(storage), [item]);
  const unavailable = {
    getItem() { throw new Error('Blocked'); },
    setItem() { throw new Error('Full'); },
    removeItem() { throw new Error('Blocked'); },
  };
  assert.deepEqual(readStoredCart(unavailable), []);
  assert.doesNotThrow(() => saveStoredCart([item], unavailable));
  assert.doesNotThrow(() => saveStoredCart([], unavailable));
});

test('previously saved digital quantities are restored as one unit', () => {
  const storage = memoryStorage();
  saveStoredCart([{ id: 1, name: 'Digital', type: 'DIGITAL', price: 75, quantity: 4 },
    { ...product, id: 2, name: 'Físico', price: 100, quantity: 2 }], storage);
  const cart = readStoredCart(storage);
  assert.deepEqual(cart.map(item => item.quantity), [1, 2]);
  assert.equal(cartTotals(cart).total, 275);
});

test('cart summary separates original subtotal, product discounts and payable total', () => {
  assert.deepEqual(cartTotals([
    { unitPrice: 100, price: 80, quantity: 2 }, { price: 50, quantity: 1 },
  ]), { subtotal: 250, discount: 40, total: 210 });
  assert.deepEqual(cartTotals([]), { subtotal: 0, discount: 0, total: 0 });
});
