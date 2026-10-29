import { useCallback, useState } from 'react';
import { getAdminProducts, getProductSales, getProductPrices } from '../api/admin';
import useResource from '../../../shared/hooks/useResource';
import { presetRange, productLabel } from '../model/statistics.js';
import { comparisonError, toggleComparisonProduct } from '../model/productComparison.js';
import { matchesProductName } from '../model/productSearch.js';

async function loadComparison(query, load, options) {
  if (!query) return null;
  return Promise.all(query.products.map(async product => {
    try { return { product, data: await load({ ...query, productId: product.id }, options), error: '' }; }
    catch (error) { return { product, data: null, error: error.message }; }
  }));
}

export default function useProductStatistics() {
  const [productsRevision, setProductsRevision] = useState(0);
  const loadProducts = useCallback(options => { void productsRevision; return getAdminProducts(true, options); }, [productsRevision]);
  const productsResource = useResource(loadProducts, []);
  const [draft, setDraft] = useState(() => ({ selection: [], ...presetRange('30') }));
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState(null);
  const [validation, setValidation] = useState('');
  const [revision, setRevision] = useState(0);
  const salesLoader = useCallback(options => {
    void revision;
    return loadComparison(query, getProductSales, options);
  }, [query, revision]);
  const pricesLoader = useCallback(options => {
    void revision;
    return loadComparison(query, getProductPrices, options);
  }, [query, revision]);
  const sales = useResource(salesLoader);
  const prices = useResource(pricesLoader);
  const products = [...productsResource.data].sort((a, b) => Number(a.isDeleted) - Number(b.isDeleted) || productLabel(a).localeCompare(productLabel(b), 'es'));
  function change(key, value) { setDraft(previous => ({ ...previous, [key]: value })); setValidation(''); }
  function apply(event) {
    event.preventDefault();
    const error = comparisonError(draft);
    setValidation(error);
    if (!error) {
      setQuery({ ...draft, products: draft.selection.map(entry => ({ ...products.find(product => String(product.id) === entry.id), ...entry })) });
      setRevision(value => value + 1);
    }
  }
  return { products, productsLoading: productsResource.loading, productsError: productsResource.error,
    draft, query, validation, sales, prices, change, apply, search, setSearch,
    visibleProducts: products.filter(product => matchesProductName(product.name, search)),
    toggleProduct: id => { setDraft(previous => ({ ...previous, selection: toggleComparisonProduct(previous.selection, id) })); setValidation(''); },
    dirty: query && (['from', 'to', 'groupBy'].some(key => draft[key] !== query[key]) || JSON.stringify(draft.selection) !== JSON.stringify(query.selection)),
    preset: value => { setDraft(previous => ({ ...previous, ...presetRange(value) })); setValidation(''); },
    retryProducts: () => setProductsRevision(value => value + 1),
    retry: () => setRevision(value => value + 1) };
}
