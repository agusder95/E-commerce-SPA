import { matchesProductName } from '../../model/productSearch.js';

export const freshForm = () => ({ productName: '', unitPrice: '', stock: 0, type: 'PHYSICAL', description: '',
  thumbnail: '', digitalFileKey: '', digitalFiles: [], tagIds: [], digitalUnitPrice: '', gallery: [], discountPrice: '', discountEndDate: '' });
export const formatType = type => type === 'PHYSICAL' ? 'Físico' : 'Digital';
export const tagKey = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
export const canonicalTag = name => { const value = name.trim().normalize('NFC').replace(/\s+/g, ' ').toLowerCase(); return value.charAt(0).toUpperCase() + value.slice(1); };
export function productNameForSave(product) {
  const name = product.productName.trim();
  return product.id ? name : name.normalize('NFC').toLocaleLowerCase('es')
    .replace(/(^|[^\p{L}\p{M}\p{N}])(\p{L})/gu, (_, prefix, letter) => prefix + letter.toLocaleUpperCase('es'));
}

export function changeProductType(product, type) {
  if (product.type === type) return product;
  return { ...product, type,
    unitPrice: product.type === 'DIGITAL' && type === 'BOTH' ? '' :
      product.type === 'BOTH' && type === 'DIGITAL' ? product.digitalUnitPrice : product.unitPrice,
    digitalUnitPrice: product.type === 'DIGITAL' && type === 'BOTH' ? product.unitPrice : product.digitalUnitPrice };
}


export function validateTag(name, tags) {
  if (!name || name.length > 15) return 'El tag debe tener entre 1 y 15 caracteres.';
  if (['FISICO', 'DIGITAL'].includes(tagKey(name))) return 'Físico y Digital se asignan automáticamente.';
  if (tags.some(tag => tagKey(tag.name) === tagKey(name))) return 'Ese tag ya existe (sin distinguir mayúsculas ni acentos).';
  return '';
}

export function similarTags(name, tags) {
  const key = tagKey(name);
  return tags.filter(tag => {
    const candidate = tagKey(tag.name);
    if (['FISICO', 'DIGITAL'].includes(candidate) || candidate === key) return false;
    const limit = Math.max(key.length, candidate.length) >= 7 ? 2 : 1;
    if (Math.abs(key.length - candidate.length) > limit) return false;
    let row = Array.from({ length: candidate.length + 1 }, (_, index) => index);
    for (let i = 1; i <= key.length; i++) {
      const next = [i];
      for (let j = 1; j <= candidate.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1,
        row[j - 1] + Number(key[i - 1] !== candidate[j - 1]));
      row = next;
    }
    return row[candidate.length] <= limit;
  });
}

export function productFormErrors(product) {
  const errors = [];
  const validPrice = value => {
    const number = Number(value);
    return String(value).trim() !== '' && Number.isFinite(number) && number >= 0.01 && number <= 999999999 && number === Number(number.toFixed(2));
  };
  if (!product.productName.trim()) errors.push('Nombre del producto: completá este campo.');
  if (product.productName.trim().length > 150) errors.push('Nombre del producto: usá hasta 150 caracteres.');
  if (!validPrice(product.unitPrice)) errors.push(`${product.type === 'BOTH' ? 'Precio físico' : 'Precio'}: ingresá un importe mayor que cero, con hasta dos decimales.`);
  if (product.type === 'BOTH' && !validPrice(product.digitalUnitPrice)) errors.push('Precio digital: ingresá un importe mayor que cero, con hasta dos decimales.');
  if (product.type !== 'DIGITAL' && (String(product.stock).trim() === '' || !Number.isSafeInteger(Number(product.stock)) || Number(product.stock) < 0 || Number(product.stock) > 2147483647))
    errors.push('Stock físico: ingresá una cantidad entera, desde cero.');
  if (product.type !== 'PHYSICAL' && !product.digitalFiles.length) errors.push('Archivos digitales: cargá al menos un PDF.');
  return errors;
}

export function paginateAdminProducts(products, page) {
  const pages = Math.max(1, Math.ceil(products.length / 7));
  const current = Math.max(1, Math.min(page, pages));
  return { page: current, pages, total: products.length, items: products.slice((current - 1) * 7, current * 7) };
}
export function toProductPayload(product) {
  return {
    productName: productNameForSave(product), unitPrice: Number(product.unitPrice),
    type: product.type, description: product.description, thumbnail: product.thumbnail,
    digitalFileKey: product.type === 'PHYSICAL' ? null : product.digitalFiles[0]?.key || null,
    digitalFiles: product.type === 'PHYSICAL' ? [] : product.digitalFiles.map(file => ({ ...file })), gallery: [...product.gallery],
    stock: product.type !== 'DIGITAL' ? Number(product.stock) : 0,
    tagIds: [...product.tagIds], digitalUnitPrice: product.type === 'BOTH' ? Number(product.digitalUnitPrice) : null,
    discountPrice: (product.type !== 'BOTH' || product.id) && product.discountPrice ? Number(product.discountPrice) : null,
    discountEndDate: (product.type !== 'BOTH' || product.id) && product.discountEndDate ? new Date(product.discountEndDate + 'T23:59:59Z').toISOString() : null,
  };
}
function compareStock(a, b, direction) {
  const aPhysical = a.type === 'PHYSICAL';
  const bPhysical = b.type === 'PHYSICAL';
  if (aPhysical !== bPhysical) return aPhysical ? -1 : 1;
  return (aPhysical ? direction * ((a.stock ?? 0) - (b.stock ?? 0)) : 0) || a.id - b.id;
}

export function filterAdminProducts(products, section, status, sort, search = '') {
  return products.filter(product => matchesProductName(product.name, search) && (section === 'delete'
    ? product.isDeleted === (status === 'deleted') : !product.isDeleted)).sort((a, b) =>
    sort === 'alphabetical' ? a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true }) || a.id - b.id :
      sort === 'stock-asc' ? compareStock(a, b, 1) :
      sort === 'stock-desc' ? compareStock(a, b, -1) :
      sort === 'newest' ? new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id :
        new Date(a.createdAt) - new Date(b.createdAt) || a.id - b.id);
}
