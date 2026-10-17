import { money } from '../../../shared/utils/format.js';
import { integer, presetRange, productLabel, storeToday } from '../model/statistics.js';
import DatePicker from '../../../shared/ui/DatePicker.jsx';

const dateLabel = value => value.split('-').reverse().join('/');
const dateValue = value => value.split('/').reverse().join('-');
const rate = value => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);

function ProductRanking({ title, products, adjusted = false }) {
  return <article className="overview-ranking"><h3>{title}</h3>
    {!products.length ? <p>No hay productos para mostrar en este período.</p> : <ol>{products.map(product => <li key={product.id}>
      <div><strong>{productLabel(product)}</strong><span>{integer(product.quantity)} {product.quantity === 1 ? 'unidad vendida' : 'unidades vendidas'}</span>
        <small>Creado el {dateLabel(storeToday(new Date(product.createdAt)))}</small></div>
      {adjusted && <div className="overview-ranking-rate"><strong>{rate(product.unitsPerDay)} u./día</strong>
        <small>{integer(product.availableDays)} {product.availableDays === 1 ? 'día disponible' : 'días disponibles'} en el período</small></div>}
    </li>)}</ol>}
  </article>;
}

export default function StatisticsOverview({ manager: m }) {
  const today = storeToday();
  return <section className="statistics-overview" aria-labelledby="store-overview-title">
    <div className="statistics-overview-heading"><h2 id="store-overview-title">Resumen de la tienda</h2>
      <span>{dateLabel(m.query.from)} – {dateLabel(m.query.to)} · Hora de Argentina</span></div>
    <form className="overview-filters" onSubmit={m.apply}>
      <div className="overview-presets" role="group" aria-label="Períodos del resumen">
        {[['1', 'Hoy'], ['7', '7 días'], ['30', '30 días']].map(([value, label]) => {
          const range = presetRange(value, today);
          return <button type="button" key={value} aria-pressed={m.draft.from === range.from && m.draft.to === range.to}
            onClick={() => m.preset(value)}>{label}</button>;
        })}
      </div>
      <div className="overview-dates"><label htmlFor="overview-from">Desde<DatePicker id="overview-from" allowPast maxDate={today}
        value={dateLabel(m.draft.from)} onChange={value => m.change('from', dateValue(value))} required /></label>
        <label htmlFor="overview-to">Hasta<DatePicker id="overview-to" allowPast maxDate={today} value={dateLabel(m.draft.to)}
          onChange={value => m.change('to', dateValue(value))} required /></label>
        <button type="submit" className="btn-primary">Aplicar período</button></div>
      {m.validation && <p role="alert" className="overview-filter-error">{m.validation}</p>}
      {m.dirty && !m.validation && <p role="status">Presioná «Aplicar período» para actualizar el resumen.</p>}
    </form>
    {m.loading ? <p role="status">Cargando resumen…</p> : m.error ? <div role="alert"><p>{m.error}</p>
      <button type="button" className="btn-secondary" onClick={m.retry}>Reintentar</button></div> : m.data && <>
      <div className="stats-grid">{[
        ['Importe vendido', money(m.data.sales, 2)], ['Compras aprobadas', integer(m.data.purchases)],
        ['Unidades vendidas', integer(m.data.quantity)], ['Productos activos', integer(m.data.products)], ['Promedio por compra', money(m.data.average, 2)]
      ].map(([name, value]) => <article className="stat-card" key={name}><span>{name}</span><strong>{value}</strong></article>)}</div>
      <div className="overview-rankings"><ProductRanking title="Top 3 más vendidos" products={m.data.topProducts} />
        <ProductRanking title="3 productos con menor ritmo de ventas" products={m.data.leastSoldProducts} adjusted /></div>
      <p className="overview-explanation">Los menos vendidos se ordenan por unidades por día, desde su creación o el inicio del período, lo que sea posterior.
        Se incluyen productos activos sin ventas. Los formatos físico y digital se cuentan por separado. «Productos activos» muestra el catálogo actual.</p>
      {m.data.excludedOrdersWithoutApprovalDate > 0 && <p className="overview-explanation">Se excluyeron {integer(m.data.excludedOrdersWithoutApprovalDate)} compras históricas sin fecha de aprobación conocida.</p>}
    </>}
  </section>;
}
