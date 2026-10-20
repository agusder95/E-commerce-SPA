import { money } from '../../../../shared/utils/format';
import { formatType } from '../model/productForm';
import { formatDate } from '../../../../shared/utils/date.js';
import { IconPhoto, IconDownload, IconPackage, IconTrash, IconRestore, IconMinus, IconPlus, IconInfoCircle } from '@tabler/icons-react';
import { MAX_STOCK } from '../model/productStock';
import SortableHeader from '../../components/SortableHeader';

export default function ProductManagementList({ section, status, sort, selected, loading, busy, pagination, onPage, selectedCount,
  products: visible, search, onSearch, onSort, onStatus, onEdit, onToggle, onSelectAll, onRequestStatus, stockEditor }) {
  const selectedProducts = visible.filter(product => selected.includes(product.id));
  const allSelected = visible.length > 0 && selectedProducts.length === visible.length;
  return <>
      <div className="product-list-heading"><div><h3>{section === 'edit' ? 'Editar productos' : status === 'deleted' ? 'Productos eliminados' : 'Borrar productos'}</h3>
        <p>{section === 'edit' ? 'Elegí un producto para actualizar su información.' : status === 'deleted' ? 'Seleccioná los productos que querés volver a mostrar en el catálogo.' : 'Seleccioná los productos que querés quitar del catálogo. Podés restaurarlos después.'}</p></div>
        {!loading && <span className="product-list-count">{pagination.total} productos</span>}</div>
      <div className="admin-filters product-list-filters">
        <label>Buscar por nombre<input type="search" placeholder="Nombre del producto" value={search} disabled={busy}
          onChange={event => onSearch(event.target.value)} /></label>
        {section === 'edit' && <div className="product-stock-actions"><button type="button" className={`btn-secondary product-stock-mode${stockEditor.hasChanges ? ' is-active' : ''}`}
          disabled={busy || loading || !stockEditor.hasChanges} onClick={stockEditor.requestSave}><IconPackage size={18} aria-hidden="true" />Actualizar stock</button>
          <button type="button" className="icon-button" aria-label="Información sobre actualizar stock" disabled={busy} onClick={stockEditor.showInfo}><IconInfoCircle size={20} aria-hidden="true" /></button></div>
        }
        {section === 'delete' && <label>Mostrar<select value={status} disabled={busy} onChange={event => {
          onStatus(event.target.value);
        }}><option value="current">Actuales</option><option value="deleted">Eliminados</option></select></label>}
      </div>
      {section === 'edit' && (stockEditor.hasChanges ? <div className="product-stock-toolbar"><div><strong>Cambios de stock pendientes</strong>
        <p role="status">{stockEditor.changes.length} productos con ajustes pendientes. Tocá «Actualizar stock» para finalizar.</p></div>
        {stockEditor.changes.length > 0 && <button type="button" className="btn-secondary" disabled={busy} onClick={stockEditor.discard}>Descartar ajustes</button>}</div>
        : <p className="product-sort-hint">Tocá el nombre de una columna para alternar el orden de los productos.</p>)}
      {loading ? <p>Cargando productos…</p> : <div className="table-scroll">
        <table className="product-management-table"><thead><tr>
          {section === 'delete' && <th scope="col"><input type="checkbox" aria-label="Seleccionar los productos de esta página"
            disabled={busy || visible.length === 0} checked={allSelected}
            onChange={event => onSelectAll(event.target.checked)} /></th>}
          {[['name', 'Producto'], ['type', 'Tipo'], ['price', 'Precio'], section === 'edit' ? ['stock', 'Stock disponible'] : ['created', 'Fecha de creación']].map(([column, label]) =>
            <SortableHeader key={column} column={column} sort={sort} busy={busy} onSort={onSort}>{label}</SortableHeader>)}
        </tr></thead><tbody>{visible.map(product => <tr key={product.id}
          className={[section === 'edit' && !stockEditor.hasChanges ? 'product-edit-row' : '', selected.includes(product.id) ? 'is-selected' : ''].filter(Boolean).join(' ')}
          onClick={section === 'edit' && !stockEditor.hasChanges && !busy ? () => onEdit(product) : undefined}>
          {section === 'delete' && <td><input type="checkbox" aria-label={`Seleccionar ${product.name} (${formatType(product.type)})`}
            disabled={busy} checked={selected.includes(product.id)} onChange={() => onToggle(product.id)} /></td>}
          <td><div className="product-list-identity">{product.thumbnail ? <img className="product-list-thumbnail" src={product.thumbnail} alt="" loading="lazy" /> : <span className="product-list-no-image" aria-label="Sin imagen"><IconPhoto size={21} aria-hidden="true" /></span>}
          {section === 'edit' ? <button type="button" className="product-edit-name" disabled={busy || stockEditor.hasChanges} onClick={event => {
            event.stopPropagation(); onEdit(product);
          }}>{product.name}</button> : <span className="product-list-name">{product.name}</span>}</div></td>
          <td><span className={`product-list-type ${product.type === 'PHYSICAL' ? 'is-physical' : 'is-digital'}`}>{product.type === 'PHYSICAL' ? <IconPackage size={15} aria-hidden="true" /> : <IconDownload size={15} aria-hidden="true" />}{formatType(product.type)}</span></td><td className="product-list-price">{money(product.price)}</td>
          <td>{section === 'delete' ? formatDate(product.createdAt) || 'Sin fecha' : product.type === 'PHYSICAL'
            ? <div className="product-stock-cell" onClick={event => event.stopPropagation()}><button type="button" className="product-stock-step" aria-label={`Disminuir stock de ${product.name}`}
                disabled={busy || (stockEditor.draft[product.id]?.stock ?? product.stock ?? 0) <= 0 || (!stockEditor.draft[product.id] && stockEditor.changes.length >= 500)}
                onClick={() => stockEditor.adjust(product, -1)}><IconMinus size={16} aria-hidden="true" /></button>
              <span className={`product-stock-value${stockEditor.draft[product.id] ? ' has-changes' : ''}`}><strong>{stockEditor.draft[product.id]?.stock ?? product.stock ?? 0}</strong>
                <small>{(stockEditor.draft[product.id]?.stock ?? product.stock ?? 0) === 1 ? 'unidad' : 'unidades'}</small></span>
              <button type="button" className="product-stock-step" aria-label={`Aumentar stock de ${product.name}`}
                disabled={busy || (stockEditor.draft[product.id]?.stock ?? product.stock ?? 0) >= MAX_STOCK || (!stockEditor.draft[product.id] && stockEditor.changes.length >= 500)}
                onClick={() => stockEditor.adjust(product, 1)}><IconPlus size={16} aria-hidden="true" /></button>
            </div> : 'No requiere stock'}</td>
        </tr>)}</tbody></table>
        {!visible.length && <p className="product-list-empty">{search.trim() ? 'No hay productos que coincidan con la búsqueda.' : status === 'deleted' && section === 'delete' ? 'No hay productos eliminados.' : 'No hay productos actuales.'}</p>}
      </div>}
      {!loading && pagination.pages > 1 && <nav className="purchases-pagination" aria-label="Paginación de productos">
        <button type="button" className="btn-secondary" disabled={busy || pagination.page === 1} onClick={() => onPage(pagination.page - 1)}>Anterior</button>
        <span aria-live="polite">Página {pagination.page} de {pagination.pages}</span>
        <button type="button" className="btn-secondary" disabled={busy || pagination.page === pagination.pages} onClick={() => onPage(pagination.page + 1)}>Siguiente</button>
      </nav>}
      {section === 'delete' && <div className={`product-list-actions ${status === 'deleted' ? 'is-restore' : 'is-delete'}`}><span><strong>{selectedCount}</strong> seleccionados en total</span>
        <button type="button" className="btn-primary" disabled={busy || !selectedCount} onClick={() => {
          onRequestStatus();
        }}>{status === 'deleted' ? <IconRestore size={18} aria-hidden="true" /> : <IconTrash size={18} aria-hidden="true" />}{status === 'deleted' ? 'Restaurar productos' : 'Eliminar productos'}</button></div>}
  </>;
}
