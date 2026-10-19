import { money } from '../../../../shared/utils/format';
import { formatType } from '../model/productForm';
import { formatDate } from '../../../../shared/utils/date.js';

export default function ProductManagementList({ section, status, sort, selected, loading, busy, pagination, onPage, selectedCount,
  products: visible, search, onSearch, onSort, onStatus, onEdit, onToggle, onSelectAll, onRequestStatus }) {
  const selectedProducts = visible.filter(product => selected.includes(product.id));
  const allSelected = visible.length > 0 && selectedProducts.length === visible.length;
  return <>
      <div className="admin-filters product-list-filters">
        <label>Buscar por nombre<input type="search" placeholder="Nombre del producto" value={search} disabled={busy}
          onChange={event => onSearch(event.target.value)} /></label>
        <label>Ordenar por<select value={sort} disabled={busy} onChange={event => onSort(event.target.value)}>
          <option value="alphabetical">Alfabético (A–Z)</option><option value="newest">Más nuevos</option><option value="oldest">Más viejos</option>
          <option value="stock-desc">Stock (mayor a menor)</option><option value="stock-asc">Stock (menor a mayor)</option>
        </select></label>
        {section === 'delete' && <label>Mostrar<select value={status} disabled={busy} onChange={event => {
          onStatus(event.target.value);
        }}><option value="current">Actuales</option><option value="deleted">Eliminados</option></select></label>}
      </div>
      {loading ? <p>Cargando productos…</p> : <div className="table-scroll">
        <table className="product-management-table"><thead><tr>
          <th scope="col">Miniatura</th><th scope="col">Nombre</th><th scope="col">Tipo</th><th scope="col">Precio</th><th scope="col">{section === 'delete' ? 'Fecha de creación' : 'Stock disponible'}</th>
          {section === 'delete' && <th scope="col"><input type="checkbox" aria-label="Seleccionar los productos de esta página"
            disabled={busy || visible.length === 0} checked={allSelected}
            onChange={event => onSelectAll(event.target.checked)} /></th>}
        </tr></thead><tbody>{visible.map(product => <tr key={product.id}
          className={section === 'edit' ? 'product-edit-row' : ''}
          onClick={section === 'edit' ? () => onEdit(product) : undefined}>
          <td>{product.thumbnail ? <img className="product-list-thumbnail" src={product.thumbnail} alt="" loading="lazy" /> : <span>Sin imagen</span>}</td>
          <td>{section === 'edit' ? <button type="button" className="product-edit-name" onClick={event => {
            event.stopPropagation(); onEdit(product);
          }}>{product.name}</button> : product.name}</td>
          <td>{formatType(product.type)}</td><td>{money(product.price)}</td>
          <td>{section === 'delete' ? formatDate(product.createdAt) || 'Sin fecha' : product.type === 'PHYSICAL'
            ? <span className="product-stock-value"><strong>{product.stock ?? 0}</strong> {(product.stock ?? 0) === 1 ? 'unidad' : 'unidades'}</span> : 'No requiere stock'}</td>
          {section === 'delete' && <td><input type="checkbox" aria-label={`Seleccionar ${product.name} (${formatType(product.type)})`}
            disabled={busy} checked={selected.includes(product.id)} onChange={() => onToggle(product.id)} /></td>}
        </tr>)}</tbody></table>
        {!visible.length && <p className="product-list-empty">{search.trim() ? 'No hay productos que coincidan con la búsqueda.' : status === 'deleted' && section === 'delete' ? 'No hay productos eliminados.' : 'No hay productos actuales.'}</p>}
      </div>}
      {!loading && pagination.pages > 1 && <nav className="purchases-pagination" aria-label="Paginación de productos">
        <button type="button" className="btn-secondary" disabled={busy || pagination.page === 1} onClick={() => onPage(pagination.page - 1)}>Anterior</button>
        <span aria-live="polite">Página {pagination.page} de {pagination.pages}</span>
        <button type="button" className="btn-secondary" disabled={busy || pagination.page === pagination.pages} onClick={() => onPage(pagination.page + 1)}>Siguiente</button>
      </nav>}
      {section === 'delete' && <div className="product-list-actions"><span>{selectedCount} seleccionados en total</span>
        <button type="button" className="btn-primary" disabled={busy || !selectedCount} onClick={() => {
          onRequestStatus();
        }}>{status === 'deleted' ? 'Restaurar productos' : 'Eliminar productos'}</button></div>}
  </>;
}
