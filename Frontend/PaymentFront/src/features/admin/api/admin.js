import { apiFetch } from '../../../shared/api/client';
import { mapProduct } from '../../catalog/model/product';

export async function getAdminProducts(includeDeleted = false, options) {
  return (await apiFetch(`/api/admin/products?includeDeleted=${includeDeleted}`, options)).map(p => ({
    ...mapProduct(p.product), digitalFileKey: p.digitalFileKey,
    digitalFiles: p.digitalFiles || (p.digitalFileKey ? [{ key: p.digitalFileKey, name: p.digitalFileKey.split('/').pop() }] : []),
    isDeleted: p.isDeleted,
  }));
}
export const changeProductStatus = (ids, deleted) => apiFetch('/api/admin/products/status', {
  method: 'POST', body: JSON.stringify({ ids, deleted }),
});
export const updateProductStock = items => apiFetch('/api/admin/products/stock', {
  method: 'PATCH', body: JSON.stringify({ items }),
});
export const importImageUrl = url => apiFetch('/api/admin/assets/image-url', {
  method: 'POST', body: JSON.stringify({ url }),
});
export const getDigitalPreview = key => apiFetch(`/api/admin/assets/digital-preview?key=${encodeURIComponent(key)}`);
export const getAdminDashboard = (query, options) => apiFetch(`/api/admin/dashboard?${new URLSearchParams({ from: query.from, to: query.to })}`, options);
const statisticsPath = (kind, query) => `/api/admin/statistics/products/${encodeURIComponent(query.productId)}/${kind}?${new URLSearchParams({
  from: query.from, to: query.to, ...(kind === 'sales' ? { groupBy: query.groupBy } : {}),
})}`;
export const getProductSales = (query, options) => apiFetch(statisticsPath('sales', query), options);
export const getProductPrices = (query, options) => apiFetch(statisticsPath('prices', query), options);
export const getTags = options => apiFetch('/api/admin/tags', options);
export const createTag = name => apiFetch('/api/admin/tags', { method: 'POST', body: JSON.stringify({ name }) });
export const deleteTags = ids => apiFetch('/api/admin/tags/delete', { method: 'POST', body: JSON.stringify({ ids }) });
export const getAdminOrders = options => apiFetch('/api/admin/orders', options);
export const changeOrderStatus = (id, restore) => apiFetch(`/api/admin/orders/${id}/${restore ? 'restore' : 'cancel'}`, { method: 'POST' });
export const getCoupons = options => apiFetch('/api/admin/coupons', options);
export const saveCoupon = (data, id) => apiFetch(`/api/admin/coupons${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) });
export const saveProductOffers = data => apiFetch('/api/admin/products/offers', { method: 'PUT', body: JSON.stringify(data) });
export const saveProduct = (id, data) => apiFetch(`/api/admin/products${id ? '/' + id : ''}`, {
  method: id ? 'PUT' : 'POST', body: JSON.stringify(data),
});
export const deleteProduct = id => apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
export async function uploadAsset(file, kind) {
  const form = new FormData(); form.append('file', file);
  return apiFetch(`/api/admin/assets/${kind}`, { method: 'POST', body: form });
}
