import test from 'node:test';
import assert from 'node:assert/strict';
import { freshForm, similarTags, productFormErrors, paginateAdminProducts } from '../src/features/admin/products/model/productForm.js';

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
