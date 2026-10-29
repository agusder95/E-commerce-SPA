export const MAX_STOCK = 2147483647;

export { nextTableSort as nextProductSort } from '../../model/tableSort.js';

export function adjustStockDraft(draft, product, amount) {
  if (product.type !== 'PHYSICAL' || product.isDeleted || ![1, -1].includes(amount)) return draft;
  const current = draft[product.id]?.stock ?? product.stock ?? 0;
  const stock = current + amount;
  if (!Number.isSafeInteger(stock) || stock < 0 || stock > MAX_STOCK) return draft;
  if (!draft[product.id] && Object.keys(draft).length >= 500) return draft;
  const next = { ...draft };
  if (stock === (product.stock ?? 0)) delete next[product.id];
  else next[product.id] = {
    idProduct: product.id, name: product.name, expectedStock: product.stock ?? 0, stock,
  };
  return next;
}
