import { expirationISO } from '../../../shared/utils/date.js';
import { matchesProductName } from './productSearch.js';
import { compareTableValues, dateSortValue, normalizeTableSort } from './tableSort.js';
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

export function filterOfferProducts(products, tags, sort, offerStatus = 'all', now = Date.now(), search = '', discount = '') {
  return products.filter(product => !product.isDeleted && matchesProductName(product.name, search) && tags.every(tag => product.tags.some(value => tagKey(value) === tagKey(tag))) &&
    (offerStatus === 'all' || hasActiveOffer(product, now) === (offerStatus === 'active')))
    .sort((a, b) => {
      if (sort === 'stock-asc' || sort === 'stock-desc') {
        const physical = Number(b.type === 'PHYSICAL') - Number(a.type === 'PHYSICAL');
        return physical || (a.type === 'PHYSICAL' ? (a.stock - b.stock) * (sort === 'stock-asc' ? 1 : -1) : 0) || a.id - b.id;
      }
      const [column, direction] = normalizeTableSort(sort).split('-');
      const value = product => {
        if (column === 'type') return product.type === 'PHYSICAL' ? 'Físico' : 'Digital';
        if (column === 'price') return product.unitPrice;
        if (column === 'currentPrice') return product.price ?? (hasActiveOffer(product, now) ? product.discountPrice : product.unitPrice);
        if (column === 'simulatedPrice') return Number(discount) >= 1 && Number(discount) <= 99 ? simulatedPrice(product.unitPrice, discount) : null;
        if (column === 'expiration') return product.discountPrice > 0 ? dateSortValue(product.discountEndDate) : null;
        if (column === 'created') return dateSortValue(product.createdAt);
        return product.name;
      };
      return compareTableValues(value(a), value(b), direction) || a.id - b.id;
    });
}
export function couponStatus(coupon, now = Date.now()) {
  if (coupon.expirationDate && new Date(coupon.expirationDate).getTime() <= now) return 'expired';
  return coupon.isActive ? 'active' : 'inactive';
}
export const couponStatusLabels = { active: 'Activo', expired: 'Vencido', inactive: 'Inactivo' };
export const couponScope = coupon => `${coupon.productType ? coupon.productType === 'PHYSICAL' ? 'Físico' : 'Digital' : 'Todos los tipos'} · ${coupon.tags?.length ? coupon.tags.join(', ') : 'Todos los tags'}`;
export function filterCoupons(coupons, status, sort, now = Date.now()) {
  return coupons.filter(coupon => status === 'all' || couponStatus(coupon, now) === status).sort((a, b) => {
    const [column, direction] = sort.split('-');
    const value = coupon => {
      if (column === 'code') return coupon.code;
      if (column === 'discount') return coupon.discount;
      if (column === 'status') return couponStatusLabels[couponStatus(coupon, now)];
      if (column === 'scope') return couponScope(coupon);
      if (column === 'cumulative') return Boolean(coupon.cumulative);
      return dateSortValue(column === 'expiration' ? coupon.expirationDate : coupon.createdAt);
    };
    return compareTableValues(value(a), value(b), direction) || a.idCoupon - b.idCoupon;
  });
}
export function couponPayload(form) {
  return { code: normalizeCouponCode(form.code), discount: Number(form.discount), expirationDate: expirationISO(form.expiration),
    productType: form.productType || null, tagIds: [...form.tagIds], isActive: form.isActive, cumulative: Boolean(form.cumulative) };
}
