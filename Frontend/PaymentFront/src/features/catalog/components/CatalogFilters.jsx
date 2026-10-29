import { IconSearch, IconAdjustmentsHorizontal, IconDiscount2, IconChevronDown } from '@tabler/icons-react';

export default function CatalogFilters({ categories, selectedTags, search, sort, onCategory, onSearch, onSort, discountedOnly, onDiscountedOnly }) {
  const hasFilters = selectedTags.length > 0 || search.trim() !== '' || discountedOnly || sort !== 'featured';
  return <details className="catalog-filter-panel">
    <summary className="catalog-filter-toggle"><IconAdjustmentsHorizontal size={19} aria-hidden="true" /><span>Buscar, filtrar y ordenar</span>{hasFilters && <span className="catalog-filter-active">Filtros activos</span>}<IconChevronDown className="catalog-filter-chevron" size={18} aria-hidden="true" /></summary>
    <div className="catalog-tools">
      <div className="catalog-inputs"><label className="catalog-search-label"><span>Buscar un juego o recurso</span><span className="search-field"><IconSearch size={18} aria-hidden="true" />
        <input type="search" aria-label="Buscar productos" placeholder="¿Qué te gustaría descubrir?" value={search} onChange={e => onSearch(e.target.value)} /></span></label>
        <label className="catalog-sort-label"><span>Ordenar por</span><select aria-label="Ordenar productos" value={sort} onChange={e => onSort(e.target.value)}>
          <option value="featured">Más recientes</option><option value="low">Menor precio</option><option value="high">Mayor precio</option>
        </select></label>
      </div>
      <div className="catalog-tags"><div className="catalog-filter-heading"><IconAdjustmentsHorizontal size={17} aria-hidden="true" /><span>Categorías</span><span>{selectedTags.length}/2 seleccionadas</span></div><div className="category-tabs" role="group" aria-label="Filtrar por tags">{categories.map(c => {
        const active = c === 'Todos' ? selectedTags.length === 0 : selectedTags.includes(c);
        return <button key={c} type="button" className={active ? 'active' : ''} onClick={() => onCategory(c)}
          disabled={c !== 'Todos' && !active && selectedTags.length === 2} aria-pressed={active}>{c}</button>;
      })}</div><p>Podés combinar hasta dos categorías para afinar tu búsqueda.</p>
      </div>
      <div className="catalog-filter-footer"><label className="catalog-discount-filter"><input type="checkbox" checked={discountedOnly}
          onChange={event => onDiscountedOnly(event.target.checked)} /><IconDiscount2 size={18} aria-hidden="true" />Solo productos con descuento</label></div>
    </div>
  </details>;
}
