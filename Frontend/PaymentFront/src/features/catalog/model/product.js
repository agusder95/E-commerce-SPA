export const productNameKey = name => name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');

export function mapProduct(p) {
  const discounted = p.discountPrice > 0 && p.discountPrice < p.unitPrice &&
    (!p.discountEndDate || new Date(p.discountEndDate).getTime() > Date.now());
  return { ...p, id: p.idProduct, name: p.productName, price: discounted ? p.discountPrice : p.unitPrice,
    discounted, category: p.tags?.[0] || 'Productos', tags: p.tags || [], gallery: p.gallery || [] };
}

export function productImages(product) {
  return [...new Set([product.thumbnail, ...product.gallery].filter(Boolean))];
}

export function productDetailFamily(product, all) {
  const variants = all.filter(variant => productNameKey(variant.name) === productNameKey(product.name))
    .map(variant => variant.id === product.id ? product : variant);
  if (!variants.some(variant => variant.id === product.id)) variants.push(product);
  const base = variants.find(variant => variant.type === 'DIGITAL') || product;
  const ordered = [base, ...variants.filter(variant => variant.id !== base.id)];
  const uniqueTags = new Map();
  for (const tag of ordered.flatMap(variant => variant.tags)) {
    const key = productNameKey(tag);
    if (!uniqueTags.has(key)) uniqueTags.set(key, tag);
  }
  const tags = [...uniqueTags.values()];
  const images = [...new Set(ordered.flatMap(productImages))];
  return { detail: { ...base, tags, category: tags[0] || 'Productos', thumbnail: images[0], gallery: images }, variants };
}
