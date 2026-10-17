import { productNameKey } from './product.js';

export const PAGE_SIZE = 6;
const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
const tagKey = tag => tag.normalize('NFC').trim().toLocaleLowerCase('es');

export function groupProducts(products) {
  const groups = new Map();
  for (const product of products) {
    const key = productNameKey(product.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(product);
  }
  return [...groups.values()].map(variants => {
    const cheapest = variants.reduce((best, variant) => variant.price < best.price ? variant : best);
    return { ...cheapest, variants, tags: [...new Set(variants.flatMap(variant => variant.tags))],
      thumbnail: cheapest.thumbnail || variants.find(variant => variant.thumbnail)?.thumbnail,
      createdAt: variants.map(variant => variant.createdAt).filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0],
      hasDiscount: variants.some(variant => variant.discounted),
      discountedTypes: [...new Set(variants.filter(variant => variant.discounted).map(variant => variant.type))] };
  });
}

export function catalogCategories(products) {
  return ['Todos', ...new Set(products.flatMap(product => product.tags))];
}

export function filterCatalog(products, category, search, sort, discountedOnly = false) {
  const selected = Array.isArray(category) ? category : category === 'Todos' ? [] : [category];
  return products.filter(product => (!discountedOnly || product.hasDiscount || product.discounted) &&
    selected.every(tag => product.tags.some(value => tagKey(value) === tagKey(tag))) &&
    product.name.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))).sort((a, b) =>
    sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price :
      (new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) || b.id - a.id);
}

export function featuredProducts(groups, { recent = false, tag, now = Date.now() } = {}) {
  return groups.map(group => {
    const dates = group.variants.filter(variant => !tag || variant.tags.some(value => tagKey(value) === tagKey(tag)))
      .map(variant => new Date(variant.createdAt).getTime())
      .filter(date => Number.isFinite(date) && date <= now && (!recent || date > now - TWO_WEEKS));
    return { group, date: dates.length ? Math.max(...dates) : null };
  }).filter(item => item.date !== null).sort((a, b) => b.date - a.date || b.group.id - a.group.id)
    .slice(0, 5).map(item => item.group);
}

export function paginateProducts(products, page) {
  const pages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const current = Math.min(pages, Math.max(1, Math.floor(page) || 1));
  return { items: products.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), page: current, pages };
}
