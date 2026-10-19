import { offerMoney, simulatedPrice } from '../model/offers.js';
import { formatDate } from '../../../shared/utils/date.js';

export default function OfferProducts({ manager: m }) {
  const allSelected = m.visibleProducts.length > 0 && m.visibleProducts.every(product => m.selected.includes(product.id));
  const preview = Number(m.discount) >= 1 && Number(m.discount) <= 99;
  return <section className="offers-section" aria-labelledby="offer-products-title"><h3 id="offer-products-title">Selección de productos</h3>
    <fieldset className="offers-tag-picker" disabled={m.busy}><legend>Filtrar por tags</legend><div>
      {m.tags.map(tag => <label key={tag.idTag}><input type="checkbox" checked={m.productTags.includes(tag.name)} onChange={() => m.toggleTag(tag.name)} />{tag.name}</label>)}
    </div><p>Al seleccionar varios tags, se muestran productos que tengan todos.</p></fieldset>
    <div className="admin-filters product-list-filters"><label>Buscar por nombre<input type="search" placeholder="Nombre del producto" value={m.productSearch} disabled={m.busy}
      onChange={event => m.setProductSearch(event.target.value)} /></label><label>Mostrar productos<select value={m.offerStatus} disabled={m.busy} onChange={event => m.setOfferStatus(event.target.value)}>
      <option value="all">Todos</option><option value="active">Con oferta activa</option><option value="inactive">Sin oferta activa</option>
    </select></label><label>Ordenar productos<select value={m.productSort} disabled={m.busy} onChange={event => m.setProductSort(event.target.value)}>
      <option value="alphabetical">Alfabético (A–Z)</option><option value="price-asc">Precio original (menor a mayor)</option><option value="price-desc">Precio original (mayor a menor)</option>
      <option value="newest">Más nuevos</option><option value="oldest">Más viejos</option><option value="stock-asc">Stock (menor a mayor)</option><option value="stock-desc">Stock (mayor a menor)</option>
    </select></label></div>
    <p>{m.productsPagination.total} productos encontrados. Los productos seleccionados se conservan al cambiar los filtros o de página.</p>
    <div className="table-scroll"><table><thead><tr>
      <th scope="col"><input type="checkbox" aria-label="Seleccionar los productos de esta página" checked={allSelected} disabled={m.busy || !m.visibleProducts.length} onChange={event => m.selectVisible(event.target.checked)} /></th>
      <th scope="col">Imagen</th><th scope="col">Producto</th><th scope="col">Tipo</th><th scope="col" className="offer-price-original">Precio original</th><th scope="col" className="offer-price-current">Precio actual</th><th scope="col" className="offer-price-simulated">Precio simulado</th><th scope="col">Vencimiento actual</th>
    </tr></thead><tbody>{m.visibleProducts.map(product => <tr key={product.id}>
      <td><input type="checkbox" aria-label={`Seleccionar ${product.name} (${product.type === 'PHYSICAL' ? 'Físico' : 'Digital'})`} disabled={m.busy} checked={m.selected.includes(product.id)} onChange={() => m.toggleProduct(product.id)} /></td>
      <td>{product.thumbnail ? <img className="product-list-thumbnail" src={product.thumbnail} alt="" loading="lazy" /> : <span>Sin imagen</span>}</td>
      <td>{product.name}</td><td>{product.type === 'PHYSICAL' ? 'Físico' : 'Digital'}</td><td className="offer-price-original">{offerMoney(product.unitPrice)}</td><td className="offer-price-current">{offerMoney(product.price)}</td>
      <td className="offer-price-simulated">{preview ? offerMoney(simulatedPrice(product.unitPrice, m.discount)) : 'Ingresá un porcentaje'}</td>
      <td>{product.discountPrice > 0 ? formatDate(product.discountEndDate) || 'Sin vencimiento' : 'Sin oferta'}</td>
    </tr>)}</tbody></table></div>
    {!m.visibleProducts.length && <p>No hay productos con estos filtros.</p>}
    {m.productsPagination.pages > 1 && <nav className="purchases-pagination" aria-label="Paginación de productos en ofertas">
      <button type="button" className="btn-secondary" disabled={m.busy || m.productsPagination.page === 1} onClick={() => m.setProductPage(m.productsPagination.page - 1)}>Anterior</button>
      <span aria-live="polite">Página {m.productsPagination.page} de {m.productsPagination.pages}</span>
      <button type="button" className="btn-secondary" disabled={m.busy || m.productsPagination.page === m.productsPagination.pages} onClick={() => m.setProductPage(m.productsPagination.page + 1)}>Siguiente</button>
    </nav>}
  </section>;
}
