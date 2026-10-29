import test from 'node:test';
import assert from 'node:assert/strict';
import { mapProduct, productImages, productNameKey, productDetailFamily } from '../src/features/catalog/model/product.js';
import { groupProducts, featuredProducts, filterCatalog, paginateProducts } from '../src/features/catalog/model/catalog.js';

const now = Date.parse('2026-10-11T12:00:00Z');
const day = 86400000;
const product = (id, options = {}) => mapProduct({ idProduct: id, productName: `Producto ${id}`, unitPrice: 100,
  type: 'DIGITAL', tags: ['Arte'], createdAt: new Date(now - id * day).toISOString(), ...options });

test('same-name variants form one card with the lowest effective price and every discounted format', () => {
  const products = [product(1, { productName: ' Diseño  azul ', unitPrice: 500, discountPrice: 350, type: 'PHYSICAL', tags: ['Físico', 'Colecciones'], thumbnail: 'cover' }),
    product(2, { productName: 'diseño azul', unitPrice: 200, tags: ['Digital', 'Arte'] })];
  const [group] = groupProducts(products);
  assert.equal(groupProducts(products).length, 1);
  assert.equal(group.price, 200); assert.equal(group.id, 2);
  assert.equal(group.hasDiscount, true); assert.deepEqual(group.discountedTypes, ['PHYSICAL']);
  assert.deepEqual(group.tags, ['Físico', 'Colecciones', 'Digital', 'Arte']); assert.equal(group.thumbnail, 'cover');
  assert.equal(group.createdAt, products[0].createdAt);
  assert.equal(productNameKey('Dise\u006e\u0303o'), productNameKey('Diseño'));
  assert.equal(products[1].thumbnail, undefined);
});

test('new section contains at most five groups strictly younger than two weeks, not future/invalid dates', () => {
  const products = Array.from({ length: 9 }, (_, index) => product(index + 1));
  products.push(product(20, { createdAt: new Date(now - 14 * day).toISOString() }),
    product(21, { createdAt: new Date(now + day).toISOString() }), product(22, { createdAt: 'invalid' }));
  assert.deepEqual(featuredProducts(groupProducts(products), { recent: true, now }).map(value => value.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(featuredProducts(groupProducts(products.slice(-3)), { recent: true, now }), []);
});

test('collections use the latest tagged variant date without duplicating a product family', () => {
  const groups = groupProducts([product(1, { productName: 'Uno', createdAt: new Date(now - 50 * day).toISOString(), tags: ['Colecciones'] }),
    product(2, { productName: 'Uno', tags: ['Digital'] }), product(3, { productName: 'Dos', tags: [' colecciones '] }),
    product(4, { tags: ['Colección'] })]);
  assert.deepEqual(featuredProducts(groups, { tag: 'Colecciones', now }).map(value => value.name), ['Dos', 'Uno']);
  assert.equal(featuredProducts(groups, { recent: true, now }).find(value => value.name === 'Uno').variants.length, 2);
});

test('two tags are combined with AND on the grouped card and price sorting uses the cheapest variant', () => {
  const groups = groupProducts([product(1, { productName: 'Uno', type: 'PHYSICAL', tags: ['Físico', 'Arte'] }),
    product(2, { productName: 'Uno', tags: ['Digital'], unitPrice: 50 }), product(3, { tags: ['Arte'] })]);
  assert.equal(filterCatalog(groups, ['Arte', 'Digital'], '', 'featured').length, 1);
  assert.equal(filterCatalog(groups, ['Físico', 'Digital'], '', 'featured').length, 1);
  assert.equal(filterCatalog(groups, ['Digital', 'Colecciones'], '', 'featured').length, 0);
  assert.equal(filterCatalog(groups, [], '', 'low')[0].price, 50);
  assert.equal(filterCatalog(groups, [], ' UNO ', 'featured').length, 1);
});

test('pagination contains six grouped cards and clamps the current page after filtering', () => {
  const products = Array.from({ length: 13 }, (_, index) => product(index + 1));
  assert.equal(paginateProducts(products, 1).items.length, 6);
  assert.equal(paginateProducts(products, 2).items.length, 6);
  assert.equal(paginateProducts(products, 3).items.length, 1);
  assert.equal(paginateProducts(products.slice(0, 2), 3).page, 1);
  assert.deepEqual(paginateProducts([], 2), { items: [], page: 1, pages: 1 });
});

test('expired or invalid discounts do not change prices or mark cards as discounted', () => {
  const dtos = [{ idProduct: 1, productName: 'Uno', unitPrice: 100, discountPrice: 80, discountEndDate: '2000-01-01' },
    { idProduct: 2, productName: 'Dos', unitPrice: 100, discountPrice: 80, discountEndDate: '9999-01-01' },
    { idProduct: 3, productName: 'Tres', unitPrice: 100, discountPrice: 110 }];
  const mapped = dtos.map(mapProduct);
  assert.deepEqual(mapped.map(value => value.price), [100, 80, 100]);
  assert.deepEqual(mapped.map(value => value.discounted), [false, true, false]);
});

test('gallery starts with the thumbnail, deduplicates URLs and supports products without images', () => {
  assert.deepEqual(productImages({ thumbnail: 'one', gallery: ['two', 'one', 'three', 'two'] }), ['one', 'two', 'three']);
  assert.deepEqual(productImages({ thumbnail: null, gallery: [] }), []);
});

test('same-name detail uses digital content and combines tags/images with digital assets first', () => {
  const physical = product(1, { productName: ' Diseño azul ', type: 'PHYSICAL', unitPrice: 50, stock: 3,
    description: 'Descripción física', tags: ['Arte', 'Físico', ' arte '], thumbnail: 'physical', gallery: ['shared', 'physical'] });
  const digital = product(2, { productName: 'diseño azul', unitPrice: 100, description: 'Descripción digital',
    tags: ['Digital', 'Arte'], thumbnail: 'digital', gallery: ['shared', 'digital'] });
  const unrelated = product(3, { productName: 'Otro', thumbnail: 'other', tags: ['Otro'] });
  const { detail, variants } = productDetailFamily(physical, [physical, digital, unrelated]);
  assert.equal(detail.id, digital.id);
  assert.equal(detail.description, 'Descripción digital');
  assert.deepEqual(detail.tags, ['Digital', 'Arte', 'Físico']);
  assert.deepEqual(productImages(detail), ['digital', 'shared', 'physical']);
  assert.deepEqual(variants.map(variant => [variant.id, variant.price, variant.stock]), [[1, 50, 3], [2, 100, undefined]]);
  assert.deepEqual(physical.tags, ['Arte', 'Físico', ' arte ']);
  assert.deepEqual(digital.gallery, ['shared', 'digital']);
});

test('detail without a digital counterpart uses the requested product and includes it if absent from catalog', () => {
  const physical = product(1, { type: 'PHYSICAL', description: 'Solo físico', thumbnail: null, gallery: [] });
  const { detail, variants } = productDetailFamily(physical, []);
  assert.equal(detail.description, 'Solo físico');
  assert.deepEqual(productImages(detail), []);
  assert.deepEqual(variants, [physical]);
});
