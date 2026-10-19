import { useState } from 'react';
import { getProducts } from '../api/products';
import { catalogCategories, filterCatalog, groupProducts, featuredProducts, paginateProducts } from '../model/catalog';
import useResource from '../../../shared/hooks/useResource';

export default function useCatalog() {
  const { data: products, loading, error } = useResource(getProducts, []);
  const [selectedTags, setSelectedTags] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [discountedOnly, setDiscountedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const grouped = groupProducts(products);
  const filtered = filterCatalog(grouped, selectedTags, search, sort, discountedOnly);
  function toggleTag(tag) {
    setSelectedTags(previous => tag === 'Todos' ? [] : previous.includes(tag) ? previous.filter(value => value !== tag) :
      previous.length < 2 ? [...previous, tag] : previous);
    setPage(1);
  }
  return { products: grouped, loading, error, selectedTags, search, sort, toggleTag,
    discountedOnly, setDiscountedOnly: value => { setDiscountedOnly(value); setPage(1); },
    setSearch: value => { setSearch(value); setPage(1); }, setSort: value => { setSort(value); setPage(1); }, setPage,
    categories: catalogCategories(grouped), filtered, pagination: paginateProducts(filtered, page),
    newest: featuredProducts(grouped, { recent: true }), collections: featuredProducts(grouped, { tag: 'Colecciones' }) };
}
