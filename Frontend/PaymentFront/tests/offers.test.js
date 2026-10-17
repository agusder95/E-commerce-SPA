import test from 'node:test';
import assert from 'node:assert/strict';
import { dateInput, expirationISO, formatDate } from '../src/shared/utils/date.js';
import { normalizeCouponCode, simulatedPrice, discountErrors, couponErrors, freshCoupon, couponPayload,
  filterOfferProducts, filterCoupons, couponStatus, hasActiveOffer, paginateOfferProducts } from '../src/features/admin/model/offers.js';

const now = new Date(2026, 9, 14, 12).getTime();
test('dates require dd/mm/yyyy, reject nonexistent dates and expire at the end of the local day', () => {
  assert.equal(dateInput('14102026'), '14/10/2026');
  assert.equal(formatDate(expirationISO('14/10/2026')), '14/10/2026');
  const end = new Date(expirationISO('14/10/2026'));
  assert.equal(end.getHours(), 23); assert.equal(end.getMinutes(), 59);
  assert.equal(expirationISO('31/02/2026'), null); assert.equal(expirationISO('29/02/2026'), null);
  assert.ok(expirationISO('29/02/2028')); assert.equal(expirationISO('2026-10-14'), null);
});
test('percentages, expiration and offer simulations are validated', () => {
  assert.deepEqual(discountErrors('25', '14/10/2026', { now }), []);
  for (const discount of ['', '0', '100', '1.001', 'NaN']) assert.ok(discountErrors(discount, '14/10/2026', { now }).length);
  assert.ok(discountErrors('25', '13/10/2026', { now }).length);
  assert.ok(discountErrors('25', '', { now }).length);
  assert.equal(simulatedPrice(250, 20), 200); assert.equal(simulatedPrice(10.01, 25), 7.51);
});
test('coupon codes lose accents and casing, default scope is global and optional expiry stays null', () => {
  assert.equal(normalizeCouponCode('  otoño-áéíóúü  '), 'OTONO-AEIOUU');
  const form = { ...freshCoupon(), code: ' promoción ', discount: '10' };
  assert.deepEqual(couponErrors(form, now), []);
  assert.deepEqual(couponPayload(form), { code: 'PROMOCION', discount: 10, expirationDate: null, productType: null, tagIds: [], isActive: true, cumulative: false });
  assert.equal(couponPayload({ ...form, cumulative: true }).cumulative, true);
  assert.deepEqual(couponPayload({ ...form, productType: 'PHYSICAL', tagIds: [1, 2] }).tagIds, [1, 2]);
});
test('offer product filtering combines tags with AND and sorts physical stock before digital', () => {
  const products = [{ id: 1, name: 'Uno', tags: ['Arte', 'Colecciones'], type: 'PHYSICAL', unitPrice: 100, stock: 0 },
    { id: 2, name: 'Dos', tags: ['Arte'], type: 'DIGITAL', unitPrice: 50, stock: 0 },
    { id: 3, name: 'Tres', tags: ['Arte'], type: 'PHYSICAL', unitPrice: 200, stock: 5 },
    { id: 4, name: 'Borrado', tags: ['Arte'], type: 'PHYSICAL', unitPrice: 1, isDeleted: true }];
  assert.deepEqual(filterOfferProducts(products, ['arte', 'Colecciones'], 'alphabetical').map(p => p.id), [1]);
  assert.deepEqual(filterOfferProducts(products, [], 'price-asc').map(p => p.id), [2, 1, 3]);
  assert.deepEqual(filterOfferProducts(products, [], 'stock-asc').map(p => p.id), [1, 3, 2]);
  assert.deepEqual(filterOfferProducts(products, [], 'stock-desc').map(p => p.id), [3, 1, 2]);
  assert.deepEqual(products.map(p => p.id), [1, 2, 3, 4]);
});
test('active-offer filters exclude expired offers and combine with tags before pagination', () => {
  const products = Array.from({ length: 23 }, (_, index) => ({ id: index + 1, name: `Producto ${index + 1}`, tags: ['Arte'],
    unitPrice: 100, discountPrice: index % 2 === 0 ? 80 : null, discountEndDate: new Date(now + 10000).toISOString() }));
  products[1].discountPrice = 70; products[1].discountEndDate = new Date(now - 1).toISOString();
  const active = filterOfferProducts(products, ['arte'], 'price-asc', 'active', now);
  const inactive = filterOfferProducts(products, [], 'price-asc', 'inactive', now);
  assert.equal(active.length, 12); assert.equal(inactive.length, 11);
  assert.equal(hasActiveOffer(products[1], now), false);
  assert.equal(hasActiveOffer({ unitPrice: 100, discountPrice: 100 }, now), false);
  assert.equal(hasActiveOffer({ unitPrice: 100, discountPrice: 80, discountEndDate: null }, now), true);
  assert.equal(paginateOfferProducts(active, 1).items.length, 10);
  assert.equal(paginateOfferProducts(active, 2).items.length, 2);
  assert.equal(paginateOfferProducts(products, 3).items.length, 3);
  assert.equal(paginateOfferProducts(active, 99).page, 2);
  assert.equal(paginateOfferProducts([], 2).page, 1);
});
test('coupon filters separate active, expired and inactive and sort by creation or expiry', () => {
  const coupons = [{ idCoupon: 1, isActive: true, expirationDate: new Date(now + 1000).toISOString(), createdAt: '2026-10-10T00:00:00Z' },
    { idCoupon: 2, isActive: true, expirationDate: new Date(now - 1000).toISOString(), createdAt: '2026-10-12T00:00:00Z' },
    { idCoupon: 3, isActive: false, expirationDate: null, createdAt: null },
    { idCoupon: 4, isActive: true, expirationDate: null, createdAt: '2026-10-13T00:00:00Z' }];
  assert.equal(couponStatus(coupons[0], now), 'active'); assert.equal(couponStatus(coupons[1], now), 'expired');
  assert.deepEqual(filterCoupons(coupons, 'active', 'expiration-asc', now).map(c => c.idCoupon), [1, 4]);
  assert.deepEqual(filterCoupons(coupons, 'active', 'expiration-desc', now).map(c => c.idCoupon), [1, 4]);
  assert.deepEqual(filterCoupons(coupons, 'expired', 'created-desc', now).map(c => c.idCoupon), [2]);
  assert.deepEqual(filterCoupons(coupons, 'all', 'created-desc', now).map(c => c.idCoupon), [4, 2, 1, 3]);
  assert.deepEqual(filterCoupons(coupons, 'inactive', 'created-asc', now).map(c => c.idCoupon), [3]);
});
