import { expirationISO } from '../../../shared/utils/date.js';
import { matchesProductName } from './productSearch.js';
export const normalizeCouponCode = code => code.normalize('NFD').replace(/\p{M}/gu, '').trim().toUpperCase();
const tagKey = tag => tag.normalize('NFD').replace(/\p{M}/gu, '').trim().toUpperCase();
export const offerMoney = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
export const simulatedPrice = (price, percentage) => Math.round(Math.round(price * 100) * (10000 - Math.round(Number(percentage) * 100)) / 10000) / 100;
export const freshCoupon = () => ({ id: null, code: '', discount: '', expiration: '', productType: '', tagIds: [], isActive: true, cumulative: false });
export function discountErrors(discount, expiration, { optionalExpiration = false, now = Date.now() } = {}) {
  const errors = [];
  if (!discount || !Number.isFinite(Number(discount)) || Number(discount) < 1 || Number(discount) > 99 || !/^\d+(\.\d{1,2})?$/.test(String(discount)))
    errors.push('Ingresá un porcentaje entre 1 y 99, con hasta dos decimales.');
  const date = expirationISO(expiration);
  if (!(optionalExpiration && !expiration) && (!date || new Date(date).getTime() <= now)) errors.push('Ingresá una fecha actual o futura en formato dd/mm/yyyy.');
  return errors;
}
export function couponErrors(form, now = Date.now()) {
  const errors = discountErrors(form.discount, form.expiration, { optionalExpiration: true, now });
  const code = normalizeCouponCode(form.code);
  if (!code || code.length > 50) errors.unshift('Ingresá un código de hasta 50 caracteres.');
  return errors;
}
export const hasActiveOffer = (product, now = Date.now()) => product.discountPrice > 0 && product.discountPrice < product.unitPrice &&
  (!product.discountEndDate || new Date(product.discountEndDate).getTime() > now);

export function paginateOfferProducts(products, page) {
  const pages = Math.max(1, Math.ceil(products.length / 10));
  const current = Math.max(1, Math.min(page, pages));
  return { page: current, pages, total: products.length, items: products.slice((current - 1) * 10, current * 10) };
}

export function filterOfferProducts(products, tags, sort, offerStatus = 'all', now = Date.now(), search = '') {
  return products.filter(product => !product.isDeleted && matchesProductName(product.name, search) && tags.every(tag => product.tags.some(value => tagKey(value) === tagKey(tag))) &&
    (offerStatus === 'all' || hasActiveOffer(product, now) === (offerStatus === 'active')))
    .sort((a, b) => {
      if (sort === 'price-asc') return a.unitPrice - b.unitPrice || a.id - b.id;
      if (sort === 'price-desc') return b.unitPrice - a.unitPrice || a.id - b.id;
      if (sort === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0) || b.id - a.id;
      if (sort === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || a.id - b.id;
      if (sort === 'stock-asc' || sort === 'stock-desc') {
        const physical = Number(b.type === 'PHYSICAL') - Number(a.type === 'PHYSICAL');
        return physical || (a.type === 'PHYSICAL' ? (a.stock - b.stock) * (sort === 'stock-asc' ? 1 : -1) : 0) || a.id - b.id;
      }
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true }) || a.id - b.id;
    });
}
export function couponStatus(coupon, now = Date.now()) {
  if (coupon.expirationDate && new Date(coupon.expirationDate).getTime() <= now) return 'expired';
  return coupon.isActive ? 'active' : 'inactive';
}
export function filterCoupons(coupons, status, sort, now = Date.now()) {
  return coupons.filter(coupon => status === 'all' || couponStatus(coupon, now) === status).sort((a, b) => {
    if (sort === 'expiration-asc' || sort === 'expiration-desc') {
      if (!a.expirationDate || !b.expirationDate) {
        if (Boolean(a.expirationDate) !== Boolean(b.expirationDate)) return a.expirationDate ? -1 : 1;
      } else {
        const difference = new Date(a.expirationDate) - new Date(b.expirationDate);
        if (difference) return difference * (sort === 'expiration-asc' ? 1 : -1);
      }
    } else {
      const difference = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      if (difference) return difference * (sort === 'created-asc' ? 1 : -1);
    }
    return a.idCoupon - b.idCoupon;
  });
}
export function couponPayload(form) {
  return { code: normalizeCouponCode(form.code), discount: Number(form.discount), expirationDate: expirationISO(form.expiration),
    productType: form.productType || null, tagIds: [...form.tagIds], isActive: form.isActive, cumulative: Boolean(form.cumulative) };
}
