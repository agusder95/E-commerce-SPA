// The server stock stays intact; cart quantities reserve units only locally.
export function availableStock(product, cart) {
  if (product.type !== 'PHYSICAL') return product.stock;
  const quantity = cart.find(item => item.id === product.id)?.quantity ?? 0;
  return Math.max(0, product.stock - quantity);
}

export function unavailableCartProducts(cart, products) {
  const current = new Map(products.map(product => [product.id, product]));
  return cart.filter(item => item.type === 'PHYSICAL' && (!current.has(item.id) || current.get(item.id).stock <= 0));
}
