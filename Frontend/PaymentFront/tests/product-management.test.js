import test from 'node:test';
import assert from 'node:assert/strict';
import { freshForm, similarTags, productFormErrors, paginateAdminProducts, filterAdminProducts } from '../src/features/admin/products/model/productForm.js';
import { adjustStockDraft, MAX_STOCK, nextProductSort } from '../src/features/admin/products/model/productStock.js';

test('similar tags detect plural and typing differences and omit automatic or unrelated tags', () => {
  const tags = [{ name: 'Ave' }, { name: 'Memotest' }, { name: 'Físico' }, { name: 'Digital' }, { name: 'Colecciones' }];
  assert.deepEqual(similarTags('Aves', tags).map(tag => tag.name), ['Ave']);
  assert.deepEqual(similarTags('Memorest', tags).map(tag => tag.name), ['Memotest']);
  assert.deepEqual(similarTags('Físicos', tags), []);
  assert.deepEqual(similarTags('Diseño', tags), []);
});
test('product validation lists missing required fields for each format and accepts zero physical stock', () => {
  assert.equal(productFormErrors(freshForm()).length, 2);
  const valid = { ...freshForm(), productName: 'Libro', unitPrice: '200', stock: 0 };
  assert.deepEqual(productFormErrors(valid), []);
  assert.ok(productFormErrors({ ...valid, unitPrice: '100.001' }).length);
  assert.deepEqual(productFormErrors({ ...valid, unitPrice: '100.01' }), []);
  assert.ok(productFormErrors({ ...valid, stock: '' }).some(error => error.includes('Stock')));
  assert.ok(productFormErrors({ ...valid, stock: '1.5' }).some(error => error.includes('Stock')));
  const both = { ...valid, type: 'BOTH' };
  assert.equal(productFormErrors(both).length, 2);
  assert.deepEqual(productFormErrors({ ...both, digitalUnitPrice: '100', digitalFiles: [{ key: 'products/book.pdf' }] }), []);
  assert.ok(productFormErrors({ ...valid, type: 'DIGITAL' }).some(error => error.includes('PDF')));
});
test('admin product pagination limits all list pages to seven and clamps after deletions', () => {
  const products = Array.from({ length: 15 }, (_, id) => ({ id }));
  assert.deepEqual(paginateAdminProducts(products, 1).items.map(p => p.id), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(paginateAdminProducts(products, 2).items.length, 7);
  assert.equal(paginateAdminProducts(products, 3).items.length, 1);
  assert.equal(paginateAdminProducts(products.slice(0, 7), 3).page, 1);
  assert.equal(paginateAdminProducts([], 1).pages, 1);
});

test('sortable headers alternate direction and order all rows before pagination', () => {
  const products = [
    { id: 1, name: 'Zorzal', type: 'PHYSICAL', price: 200, stock: 4, isDeleted: false },
    { id: 2, name: 'Ave 10', type: 'DIGITAL', price: 40, stock: 0, isDeleted: false },
    { id: 3, name: 'Ave 2', type: 'PHYSICAL', price: 100, stock: 0, isDeleted: false },
    { id: 4, name: 'Oculto', type: 'PHYSICAL', price: 1, stock: 1, isDeleted: true },
  ];
  const ids = sort => filterAdminProducts(products, 'edit', 'current', sort).map(p => p.id);
  assert.deepEqual(ids('name-asc'), [3, 2, 1]);
  assert.deepEqual(ids('name-desc'), [1, 2, 3]);
  assert.deepEqual(ids('type-asc'), [2, 1, 3]);
  assert.deepEqual(ids('type-desc'), [1, 3, 2]);
  assert.deepEqual(ids('price-asc'), [2, 3, 1]);
  assert.deepEqual(ids('price-desc'), [1, 3, 2]);
  assert.deepEqual(ids('stock-asc'), [3, 1, 2]);
  assert.deepEqual(ids('stock-desc'), [1, 3, 2]);
  assert.equal(nextProductSort('alphabetical', 'name'), 'name-desc');
  assert.equal(nextProductSort('price-desc', 'price'), 'price-asc');
  assert.equal(nextProductSort('price-asc', 'type'), 'type-asc');
  assert.deepEqual(products.map(p => p.id), [1, 2, 3, 4]);
});

test('stock drafts preserve baselines, undo changes and enforce physical integer stock limits', () => {
  const product = { id: 1, name: 'Ave', type: 'PHYSICAL', stock: 2 };
  const first = adjustStockDraft({}, product, 1);
  const next = adjustStockDraft(first, product, 1);
  assert.deepEqual(next[1], { idProduct: 1, name: 'Ave', expectedStock: 2, stock: 4 });
  assert.deepEqual(adjustStockDraft(first, product, -1), {});
  assert.equal(first[1].stock, 3);
  assert.deepEqual(adjustStockDraft({}, { ...product, stock: 0 }, -1), {});
  assert.deepEqual(adjustStockDraft({}, { ...product, stock: MAX_STOCK }, 1), {});
  assert.deepEqual(adjustStockDraft({}, { ...product, type: 'DIGITAL' }, 1), {});
  assert.deepEqual(adjustStockDraft({}, { ...product, isDeleted: true }, 1), {});
  assert.deepEqual(adjustStockDraft({}, product, 0.5), {});
  const full = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [i + 2, { stock: 1 }]));
  assert.equal(adjustStockDraft(full, product, 1), full);
});

test('delete list sorts creation dates chronologically and retains deleted-status filters', () => {
  const products = [
    { id: 1, name: 'A', type: 'PHYSICAL', price: 10, isDeleted: false, createdAt: '2026-01-31' },
    { id: 2, name: 'B', type: 'DIGITAL', price: 20, isDeleted: false, createdAt: '2026-02-01' },
    { id: 3, name: 'C', type: 'PHYSICAL', price: 30, isDeleted: false, createdAt: null },
    { id: 4, name: 'D', type: 'PHYSICAL', price: 40, isDeleted: true, createdAt: '2025-01-01' },
  ];
  assert.deepEqual(filterAdminProducts(products, 'delete', 'current', 'created-asc').map(p => p.id), [1, 2, 3]);
  assert.deepEqual(filterAdminProducts(products, 'delete', 'current', 'created-desc').map(p => p.id), [2, 1, 3]);
  assert.deepEqual(filterAdminProducts(products, 'delete', 'deleted', 'name-desc').map(p => p.id), [4]);
});
