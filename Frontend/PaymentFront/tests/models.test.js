import test from 'node:test';
import assert from 'node:assert/strict';
import { freshForm, canonicalTag, tagKey, validateTag, changeProductType, toProductPayload, filterAdminProducts } from '../src/features/admin/products/model/productForm.js';
import { catalogCategories, filterCatalog } from '../src/features/catalog/model/catalog.js';
import { mapProduct } from '../src/features/catalog/model/product.js';
import { isTerminalStatus, paymentMessage } from '../src/features/orders/model/orderStatus.js';
import { formatTime } from '../src/features/auth/model/pin.js';
import { readRichText } from '../src/shared/rich-text/model.js';

test('new forms do not share mutable tag or image arrays', () => {
  const first = freshForm(); first.tagIds.push(1); first.gallery.push('image'); first.digitalFiles.push({ key: 'products/file' });
  assert.deepEqual(freshForm().tagIds, []); assert.deepEqual(freshForm().gallery, []); assert.deepEqual(freshForm().digitalFiles, []);
});

test('tags preserve accents, normalize Unicode and capitalization', () => {
  assert.equal(canonicalTag('  ILUSTRACIO\u0301N  '), 'Ilustración');
  assert.equal(canonicalTag(' ARTE   VISUAL '), 'Arte visual');
  assert.equal(tagKey('Diseño'), tagKey('DISENO'));
});

test('tag validation rejects duplicates, reserved names and strings beyond 15 characters', () => {
  assert.ok(validateTag('diseno', [{ name: 'Diseño' }]));
  assert.ok(validateTag('FÍSICO', [])); assert.ok(validateTag('Digital', []));
  assert.ok(validateTag('a'.repeat(16), [])); assert.ok(validateTag('', []));
  assert.equal(validateTag('a'.repeat(15), []), '');
});

test('both formats retain independent prices and physical stock in the API payload', () => {
  const payload = toProductPayload({ ...freshForm(), productName: ' Libro ', type: 'BOTH',
    unitPrice: '200', digitalUnitPrice: '75', stock: '8', tagIds: [4], digitalFileKey: 'products/book.pdf' });
  assert.equal(payload.productName, 'Libro'); assert.equal(payload.unitPrice, 200);
  assert.equal(payload.digitalUnitPrice, 75); assert.equal(payload.stock, 8);
  assert.deepEqual(payload.tagIds, [4]); assert.ok(!Object.hasOwn(payload, 'tagsText'));
});

test('new product names are saved capitalized for physical, digital and both formats', () => {
  for (const type of ['PHYSICAL', 'DIGITAL', 'BOTH']) {
    assert.equal(toProductPayload({ ...freshForm(), type, productName: '  cuaderno DE viaje  ' }).productName, 'Cuaderno De Viaje');
    assert.equal(toProductPayload({ ...freshForm(), type, productName: 'la\u0301minas-a\u0301rbol (EDICIÓN 2)' }).productName, 'Láminas-Árbol (Edición 2)');
  }
});

test('editing preserves existing product name capitalization', () => {
  assert.equal(toProductPayload({ ...freshForm(), id: 3, productName: '  eBook de ARTE  ' }).productName, 'eBook de ARTE');
});

test('physical to both keeps physical price and stock and enables an independent digital price', () => {
  const form = { ...freshForm(), id: 3, type: 'PHYSICAL', unitPrice: '200', stock: 7 };
  const both = changeProductType(form, 'BOTH');
  assert.equal(both.unitPrice, '200'); assert.equal(both.stock, 7); assert.equal(both.digitalUnitPrice, '');
  assert.equal(form.type, 'PHYSICAL');
});

test('digital to both moves the existing price to digital and asks for a physical price', () => {
  const form = { ...freshForm(), id: 4, type: 'DIGITAL', unitPrice: '75', digitalFiles: [{ key: 'products/book.pdf', name: 'Libro.pdf' }] };
  const both = changeProductType(form, 'BOTH');
  assert.equal(both.unitPrice, ''); assert.equal(both.digitalUnitPrice, '75');
  assert.deepEqual(both.digitalFiles, form.digitalFiles);
  assert.equal(changeProductType(both, 'DIGITAL').unitPrice, '75');
  assert.equal(changeProductType({ ...both, unitPrice: '200' }, 'PHYSICAL').unitPrice, '200');
});

test('temporarily switching formats does not discard physical stock and editing both retains original offers', () => {
  const form = { ...freshForm(), id: 8, unitPrice: '200', stock: 7, discountPrice: '150', discountEndDate: '2030-01-10' };
  assert.equal(changeProductType(changeProductType(form, 'DIGITAL'), 'PHYSICAL').stock, 7);
  const payload = toProductPayload(changeProductType(form, 'BOTH'));
  assert.equal(payload.discountPrice, 150); assert.equal(payload.discountEndDate, '2030-01-10T23:59:59.000Z');
});

test('digital products never send physical stock and single formats do not send a second price', () => {
  const payload = toProductPayload({ ...freshForm(), type: 'DIGITAL', stock: 10, unitPrice: 50 });
  assert.equal(payload.stock, 0); assert.equal(payload.digitalUnitPrice, null);
});

test('offer serialization is unchanged and does not leak into both-format creation', () => {
  const form = { ...freshForm(), unitPrice: '100', discountPrice: '80', discountEndDate: '2030-01-10' };
  assert.equal(toProductPayload(form).discountPrice, 80);
  assert.equal(toProductPayload(form).discountEndDate, '2030-01-10T23:59:59.000Z');
  assert.equal(toProductPayload({ ...form, type: 'BOTH' }).discountPrice, null);
});

test('admin lists exclude deleted products from editing and sort without mutating input', () => {
  const products = [
    { id: 1, name: 'Zeta', isDeleted: false, createdAt: '2025-01-01' },
    { id: 2, name: 'Arte', isDeleted: false, createdAt: '2026-01-01' },
    { id: 3, name: 'Borrado', isDeleted: true, createdAt: '2024-01-01' },
  ];
  assert.deepEqual(filterAdminProducts(products, 'edit', 'deleted', 'alphabetical').map(p => p.id), [2, 1]);
  assert.deepEqual(filterAdminProducts(products, 'delete', 'deleted', 'oldest').map(p => p.id), [3]);
  assert.deepEqual(filterAdminProducts(products, 'delete', 'current', 'newest').map(p => p.id), [2, 1]);
  assert.deepEqual(products.map(p => p.id), [1, 2, 3]);
});

test('admin stock ordering is numeric in both directions, stable on ties and excludes deleted products', () => {
  const products = [
    { id: 1, name: 'Uno', type: 'PHYSICAL', stock: 10, isDeleted: false },
    { id: 2, name: 'Dos', type: 'PHYSICAL', stock: 2, isDeleted: false },
    { id: 3, name: 'Tres', type: 'PHYSICAL', stock: 0, isDeleted: false },
    { id: 4, name: 'Cuatro', type: 'PHYSICAL', stock: 10, isDeleted: false },
    { id: 5, name: 'Borrado', type: 'PHYSICAL', stock: 100, isDeleted: true },
  ];
  assert.deepEqual(filterAdminProducts(products, 'edit', 'current', 'stock-asc').map(p => p.id), [3, 2, 1, 4]);
  assert.deepEqual(filterAdminProducts(products, 'edit', 'current', 'stock-desc').map(p => p.id), [1, 4, 2, 3]);
  assert.deepEqual(products.map(p => p.id), [1, 2, 3, 4, 5]);
});

test('both stock orders place all digital products after physical products, including zero stock', () => {
  const products = [
    { id: 1, name: 'Digital uno', type: 'DIGITAL', stock: 100, isDeleted: false },
    { id: 2, name: 'Físico agotado', type: 'PHYSICAL', stock: 0, isDeleted: false },
    { id: 3, name: 'Digital dos', type: 'DIGITAL', stock: 0, isDeleted: false },
    { id: 4, name: 'Físico disponible', type: 'PHYSICAL', stock: 5, isDeleted: false },
  ];
  assert.deepEqual(filterAdminProducts(products, 'edit', 'current', 'stock-asc').map(p => p.id), [2, 4, 1, 3]);
  assert.deepEqual(filterAdminProducts(products, 'edit', 'current', 'stock-desc').map(p => p.id), [4, 2, 1, 3]);
  assert.deepEqual(products.map(p => p.id), [1, 2, 3, 4]);
});

test('catalog categories come from database tags, with search and price sorting', () => {
  const products = [{ id: 1, name: 'Libro físico', price: 200, tags: ['Arte', 'Físico'] },
    { id: 2, name: 'Libro digital', price: 75, tags: ['Arte', 'Digital'] }];
  assert.deepEqual(catalogCategories(products), ['Todos', 'Arte', 'Físico', 'Digital']);
  assert.deepEqual(filterCatalog(products, 'Todos', 'LIBRO', 'low').map(p => p.id), [2, 1]);
  assert.equal(filterCatalog(products, 'Digital', '', 'featured').length, 1);
});

test('product DTO mapping honors active and expired offers', () => {
  const dto = { idProduct: 2, productName: 'Libro', unitPrice: 100, discountPrice: 80, tags: ['Arte'] };
  assert.equal(mapProduct(dto).price, 80);
  assert.equal(mapProduct({ ...dto, discountEndDate: '2000-01-01' }).price, 100);
  assert.deepEqual(mapProduct(dto).gallery, []);
});

test('payment terminal states and PIN countdown formatting remain consistent', () => {
  for (const status of ['APPROVED', 'REJECTED', 'CANCELLED', 'PAID_REQUIRES_REVIEW']) {
    assert.equal(isTerminalStatus(status), true); assert.ok(paymentMessage(status));
  }
  assert.equal(isTerminalStatus('PENDING_PAYMENT'), false);
  assert.equal(formatTime(300), '5:00'); assert.equal(formatTime(9), '0:09');
});

test('multiple digital files are preserved in payloads and removal does not resurrect legacy keys', () => {
  const form = { ...freshForm(), type: 'DIGITAL', digitalFileKey: 'products/old.pdf',
    digitalFiles: [{ key: 'products/one.pdf', name: 'One.pdf' }, { key: 'products/two.zip', name: 'Two.zip' }] };
  assert.equal(toProductPayload(form).digitalFiles.length, 2);
  assert.equal(toProductPayload({ ...form, digitalFiles: [] }).digitalFileKey, null);
  assert.equal(toProductPayload({ ...form, type: 'PHYSICAL' }).digitalFiles.length, 0);
  assert.equal(toProductPayload({ ...form, type: 'PHYSICAL' }).digitalFileKey, null);
});

test('rich text preserves formatting and nesting while dropping arbitrary styles and HTML attributes', () => {
  const value = JSON.stringify({ root: { type: 'root', children: [{ type: 'paragraph', format: 'center', indent: 2,
    children: [{ type: 'text', text: '<script>alert(1)</script>', format: 1, style: 'background:url(evil)', onClick: 'evil()' }] }] } });
  const document = readRichText(value);
  assert.equal(document.root.children[0].format, 'center');
  assert.equal(document.root.children[0].indent, 2);
  assert.equal(document.root.children[0].children[0].format, 1);
  assert.equal(document.root.children[0].children[0].style, '');
  assert.ok(!JSON.stringify(document).includes('onClick'));
  assert.equal(readRichText('Texto anterior\nSegunda línea'), null);
  assert.equal(readRichText(JSON.stringify({ root: { type: 'root', children: [{ type: 'script', children: [] }] } })), null);
});

test('rich text retains nested lists and line breaks, rejecting invalid hierarchy and excessive depth', () => {
  const text = { type: 'text', text: 'Elemento', format: 1 };
  const nested = { type: 'list', listType: 'number', start: 3, children: [{ type: 'listitem', children: [text] }] };
  const root = { type: 'root', children: [{ type: 'paragraph', children: [text, { type: 'linebreak' }, text] },
    { type: 'list', listType: 'bullet', children: [{ type: 'listitem', children: [text] }, { type: 'listitem', children: [nested] }] }] };
  const document = readRichText(JSON.stringify({ root }));
  assert.equal(document.root.children[0].children[1].type, 'linebreak');
  assert.equal(document.root.children[1].children[1].children[0].tag, 'ol');
  assert.equal(document.root.children[1].children[1].children[0].start, 3);
  assert.equal(readRichText(JSON.stringify({ root: { type: 'root', children: [text] } })), null);
  let deep = nested;
  for (let i = 0; i < 40; i++) deep = { type: 'list', children: [{ type: 'listitem', children: [deep] }] };
  assert.equal(readRichText(JSON.stringify({ root: { type: 'root', children: [deep] } })), null);
});
