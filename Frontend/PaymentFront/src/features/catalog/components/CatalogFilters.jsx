import { IconSearch } from '@tabler/icons-react';

export default function CatalogFilters({ categories, selectedTags, search, sort, onCategory, onSearch, onSort, discountedOnly, onDiscountedOnly }) {
  return <div className="catalog-tools">
      <div className="catalog-tags"><div className="category-tabs" role="group" aria-label="Filtrar por tags">{categories.map(c => {
        const active = c === 'Todos' ? selectedTags.length === 0 : selectedTags.includes(c);
        return <button key={c} type="button" className={active ? 'active' : ''} onClick={() => onCategory(c)}
          disabled={c !== 'Todos' && !active && selectedTags.length === 2} aria-pressed={active}>{c}</button>;
      })}</div><p>Combiná hasta dos tags. Se muestran productos que incluyan ambos.</p>
        <label className="catalog-discount-filter"><input type="checkbox" checked={discountedOnly}
          onChange={event => onDiscountedOnly(event.target.checked)} />Solo productos con descuento</label>
      </div>
      <div className="catalog-inputs"><label className="search-field"><IconSearch size={18} aria-hidden="true" />
        <input aria-label="Buscar productos" placeholder="Buscar productos…" value={search} onChange={e => onSearch(e.target.value)} /></label>
        <select aria-label="Ordenar productos" value={sort} onChange={e => onSort(e.target.value)}>
          <option value="featured">Más recientes</option><option value="low">Menor precio</option><option value="high">Mayor precio</option>
        </select>
      </div>
    </div>;
}
