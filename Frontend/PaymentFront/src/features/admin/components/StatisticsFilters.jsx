import { IconArrowRight } from '@tabler/icons-react';
import { presetRange, productLabel, storeToday } from '../model/statistics.js';

export default function StatisticsFilters({ products, visibleProducts, productsLoading, draft, validation, dirty, change, preset, apply, search, setSearch, toggleProduct }) {
  return <form className="statistics-filters" onSubmit={apply}>
    <fieldset className="statistics-product-picker"><legend>Productos para comparar ({draft.selection.length}/3)</legend>
      <label htmlFor="statistics-product-search">Buscar por nombre<input id="statistics-product-search" type="search" placeholder="Nombre del producto"
        value={search} disabled={productsLoading} onChange={event => setSearch(event.target.value)} /></label>
      <p>Seleccioná hasta 3 productos. La búsqueda conserva tu selección.</p>
      <div className="statistics-selected-products">{draft.selection.map(entry => {
        const product = products.find(product => String(product.id) === entry.id);
        return <button type="button" key={entry.id} style={{ '--series-color': entry.color }} onClick={() => toggleProduct(entry.id)}
          aria-label={`Quitar ${product ? productLabel(product) : entry.id}`}><i aria-hidden="true" />{product ? productLabel(product) : entry.id}<span aria-hidden="true">×</span></button>;
      })}</div>
      <div className="statistics-product-options">{productsLoading ? <p role="status">Cargando productos…</p> : visibleProducts.length ? visibleProducts.map(product => {
        const selected = draft.selection.find(entry => entry.id === String(product.id));
        return <label key={product.id}><input type="checkbox" checked={Boolean(selected)} disabled={!selected && draft.selection.length >= 3}
          onChange={() => toggleProduct(product.id)} />{selected && <i className="statistics-color-dot" style={{ background: selected.color }} aria-hidden="true" />}{productLabel(product)}</label>;
      }) : <p>{products.length ? 'No hay productos que coincidan con la búsqueda.' : 'Todavía no hay productos.'}</p>}</div>
      {draft.selection.length === 3 && <p role="status">Llegaste al máximo de 3 productos. Quitá uno para agregar otro.</p>}
    </fieldset>
    <fieldset className="statistics-date-fields">
      <legend>Período de consulta</legend>
      <div className="statistics-presets" aria-label="Períodos rápidos">
        {[['7', '7 días'], ['30', '30 días'], ['90', '90 días'], ['year', 'Este año']].map(([value, label]) => {
          const range = presetRange(value);
          return <button type="button" key={value} aria-pressed={draft.from === range.from && draft.to === range.to}
            onClick={() => preset(value)}>{label}</button>;
        })}
      </div>
      <div className="statistics-date-row">
        <label htmlFor="statistics-from">Desde<input id="statistics-from" type="date" max={storeToday()} value={draft.from}
          onChange={event => change('from', event.target.value)} required /></label>
        <label htmlFor="statistics-to">Hasta<input id="statistics-to" type="date" max={storeToday()} value={draft.to}
          onChange={event => change('to', event.target.value)} required /></label>
      </div>
    </fieldset>
    <div className="statistics-filter-actions">
      <label htmlFor="statistics-group">Ver ventas por
        <select id="statistics-group" value={draft.groupBy} onChange={event => change('groupBy', event.target.value)}>
          <option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option>
        </select>
      </label>
      <button className="btn-primary" type="submit" disabled={productsLoading || !products.length}>Ver estadísticas<IconArrowRight size={18} aria-hidden="true" /></button>
    </div>
    {validation && <p className="statistics-form-error" role="alert">{validation}</p>}
    {dirty && !validation && <p className="statistics-pending" role="status">Cambiaste los filtros. Presioná «Ver estadísticas» para actualizar el resultado.</p>}
  </form>;
}
