import { offerMoney, simulatedPrice } from '../model/offers.js';
import { formatDate } from '../../../shared/utils/date.js';
import { IconPhoto } from '@tabler/icons-react';
import SortableHeader from './SortableHeader';

export default function OfferProducts({ manager: m }) {
  const allSelected = m.visibleProducts.length > 0 && m.visibleProducts.every(product => m.selected.includes(product.id));
  const preview = Number(m.discount) >= 1 && Number(m.discount) <= 99;
  return <section className="offers-section offer-products-panel" aria-labelledby="offer-products-title"><div className="commerce-section-heading"><h3 id="offer-products-title">Selección de productos</h3><p>Compará los precios y elegí dónde aplicar el descuento.</p></div>
    <fieldset className="offers-tag-picker" disabled={m.busy}><legend>Filtrar por tags</legend><div>
      {m.tags.map(tag => <label key={tag.idTag}><input type="checkbox" checked={m.productTags.includes(tag.name)} onChange={() => m.toggleTag(tag.name)} />{tag.name}</label>)}
    </div><p>Al seleccionar varios tags, se muestran productos que tengan todos.</p></fieldset>
    <div className="admin-filters product-list-filters"><label>Buscar por nombre<input type="search" placeholder="Nombre del producto" value={m.productSearch} disabled={m.busy}
      onChange={event => m.setProductSearch(event.target.value)} /></label><label>Mostrar productos<select value={m.offerStatus} disabled={m.busy} onChange={event => m.setOfferStatus(event.target.value)}>
      <option value="all">Todos</option><option value="active">Con oferta activa</option><option value="inactive">Sin oferta activa</option>
    </select></label></div>
    <p>{m.productsPagination.total} productos encontrados. Los productos seleccionados se conservan al cambiar los filtros o de página.</p>
    <div className="table-scroll"><table><thead><tr>
      <th scope="col"><input type="checkbox" aria-label="Seleccionar los productos de esta página" checked={allSelected} disabled={m.busy || !m.visibleProducts.length} onChange={event => m.selectVisible(event.target.checked)} /></th>
      {[['name', 'Producto'], ['type', 'Tipo'], ['price', 'Precio original', 'offer-price-original'], ['currentPrice', 'Precio actual', 'offer-price-current'], ['simulatedPrice', 'Precio simulado', 'offer-price-simulated'], ['expiration', 'Vencimiento actual']].map(([column, label, className]) =>
        <SortableHeader key={column} column={column} className={className} sort={m.productSort} busy={m.busy} onSort={m.setProductSort}>{label}</SortableHeader>)}
    </tr></thead><tbody>{m.visibleProducts.map(product => <tr key={product.id} className={m.selected.includes(product.id) ? 'is-selected' : ''}>
      <td><input type="checkbox" aria-label={`Seleccionar ${product.name} (${product.type === 'PHYSICAL' ? 'Físico' : 'Digital'})`} disabled={m.busy} checked={m.selected.includes(product.id)} onChange={() => m.toggleProduct(product.id)} /></td>
      <td><div className="commerce-product-identity">{product.thumbnail ? <img className="product-list-thumbnail" src={product.thumbnail} alt="" loading="lazy" /> : <span className="commerce-no-image" aria-label="Sin imagen"><IconPhoto size={21} aria-hidden="true" /></span>}<span>{product.name}</span></div></td><td><span className={`commerce-type ${product.type === 'DIGITAL' ? 'is-digital' : ''}`}>{product.type === 'PHYSICAL' ? 'Físico' : 'Digital'}</span></td><td className="offer-price-original">{offerMoney(product.unitPrice)}</td><td className="offer-price-current">{offerMoney(product.price)}</td>
      <td className="offer-price-simulated">{preview ? offerMoney(simulatedPrice(product.unitPrice, m.discount)) : 'Ingresá un porcentaje'}</td>
      <td>{product.discountPrice > 0 ? formatDate(product.discountEndDate) || 'Sin vencimiento' : 'Sin oferta'}</td>
    </tr>)}</tbody></table></div>
    {!m.visibleProducts.length && <p className="commerce-empty">No hay productos con estos filtros.</p>}
    {m.productsPagination.pages > 1 && <nav className="purchases-pagination" aria-label="Paginación de productos en ofertas">
      <button type="button" className="btn-secondary" disabled={m.busy || m.productsPagination.page === 1} onClick={() => m.setProductPage(m.productsPagination.page - 1)}>Anterior</button>
      <span aria-live="polite">Página {m.productsPagination.page} de {m.productsPagination.pages}</span>
      <button type="button" className="btn-secondary" disabled={m.busy || m.productsPagination.page === m.productsPagination.pages} onClick={() => m.setProductPage(m.productsPagination.page + 1)}>Siguiente</button>
    </nav>}
  </section>;
}
