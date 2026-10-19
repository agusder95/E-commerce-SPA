import { useCallback, useState } from 'react';
import { getProduct, getProducts } from '../api/products';
import useResource from '../../../shared/hooks/useResource';
import { productDetailFamily } from '../model/product';

export default function useProductDetail(id) {
  const [selectedId, setSelectedId] = useState(null);
  const loader = useCallback(async options => {
    const [product, all] = await Promise.all([getProduct(id, options), getProducts(options)]);
    return productDetailFamily(product, all);
  }, [id]);
  const { data, loading, error } = useResource(loader);
  const variants = data?.variants || [];
  const product = variants.find(variant => variant.id === selectedId) || data?.detail;
  return { product, detail: data?.detail, variants, selectVariant: setSelectedId, loading, error };
}
