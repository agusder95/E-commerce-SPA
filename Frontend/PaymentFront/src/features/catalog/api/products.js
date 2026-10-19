import { apiFetch } from '../../../shared/api/client';
import { mapProduct } from '../model/product';

export async function getProducts(options) { return (await apiFetch('/api/products', options)).map(mapProduct); }
export async function getProduct(id, options) { return mapProduct(await apiFetch(`/api/products/${id}`, options)); }
