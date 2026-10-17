import { useId, useState } from 'react';
import { money } from '../../../shared/utils/format.js';
import { axisMoney, displayDate, displayInstant, priceGeometry } from '../model/statistics.js';
import useChartWidth from '../hooks/useChartWidth';

const cash = value => money(value, 2);
const reasonLabel = reason => ({ INITIAL_SNAPSHOT: 'Primer precio registrado', PRODUCT_CREATED: 'Producto creado',
  PRICE_CHANGE: 'Precio u oferta actualizados', OFFER_EXPIRED: 'Terminó la oferta' })[reason] || 'Precio registrado';

export default function ProductPriceChart({ data, query, color }) {
  const [container, width] = useChartWidth();
  const [selected, setSelected] = useState(0);
  const [page, setPage] = useState(1);
  const titleId = useId();
  const sliderId = useId();
  const { periods } = data;
  const geometry = priceGeometry(periods, query, width);
  const { x, y, ceiling, listPath, effectivePath } = geometry;
  const current = periods[Math.min(selected, periods.length - 1)];
  const shown = periods.slice((page - 1) * 8, page * 8);
  return <section className="statistics-chart-card" aria-labelledby={titleId}>
    <div className="statistics-chart-heading"><div><h3 id={titleId}>¿Cómo cambió el precio?</h3><p>El precio publicado en cada momento, con sus ofertas.</p></div>
      <div className="statistics-legend"><span><i className="statistics-key-list" style={color ? { borderColor: color } : undefined} />Precio de lista</span><span><i className="statistics-key-effective" style={color ? { borderColor: color } : undefined} />Precio con ofertas</span></div>
    </div>
    {data.hasUnknownPrices && <p className="statistics-inline-note">{data.coverageStartsAt
      ? `El historial está disponible desde el ${displayInstant(data.coverageStartsAt)}. Antes de esa fecha no hay precios registrados.`
      : 'Todavía no hay precios registrados para este período. Probá con fechas más recientes.'}</p>}
    <div ref={container} className="statistics-plot">
      {periods.length > 0 && <svg width={width} height="220" viewBox={`0 0 ${width} 220`} role="img"
        aria-label="Evolución del precio de lista y del precio con ofertas, en pesos. Cada escalón indica un cambio de precio. Los valores exactos están en el detalle de precios.">
        {[0, 0.5, 1].map(fraction => <g key={fraction}>
          <line x1="75" x2={width - 20} y1={y(ceiling * fraction)} y2={y(ceiling * fraction)} className="statistics-gridline" />
          <text x="65" y={y(ceiling * fraction) + 4} textAnchor="end">{axisMoney(ceiling * fraction)}</text>
        </g>)}
        {data.hasUnknownPrices && <rect x="75" y="20" width={Math.max(0, x(periods[0].from) - 75)} height="170" className="statistics-unknown-area"><title>Sin precios registrados</title></rect>}
        {periods.filter(p => p.offerPrice !== null).map(p => <rect key={`${p.from}-offer`} x={x(p.from)} y="20" width={x(p.to) - x(p.from)} height="170" className="statistics-offer-area" />)}
        <path d={listPath} className="statistics-list-line" style={color ? { stroke: color } : undefined} />
        <path d={effectivePath} className="statistics-price-line" style={color ? { stroke: color } : undefined} />
        <circle cx={x(current.from)} cy={y(current.effectivePrice)} r="4" className="statistics-price-point" style={color ? { fill: color } : undefined} />
        {periods.map((period, index) => <rect key={`${period.from}-${index}`} x={x(period.from)} y="18"
          width={Math.max(1, x(period.to) - x(period.from))} height="174" fill="transparent"
          onPointerEnter={() => setSelected(index)} onClick={() => setSelected(index)}>
          <title>{displayInstant(period.from)}: {cash(period.effectivePrice)}{period.offerPrice !== null ? ' con oferta' : ''}</title>
        </rect>)}
        <text x="75" y="215">{displayDate(query.from, true)}</text>
        <text x={width - 20} y="215" textAnchor="end">{displayDate(query.to, true)}</text>
      </svg>}
    </div>
    {current && <div className="statistics-chart-detail">
      <div><strong>{cash(current.effectivePrice)} <small>{current.offerPrice !== null ? 'Con oferta' : 'Sin oferta'}</small></strong><span>Desde el {displayInstant(current.from)} · Lista: {cash(current.listPrice)}</span></div>
      <label htmlFor={sliderId}>Explorar precios<input id={sliderId} type="range" min="0" max={periods.length - 1} disabled={periods.length === 1}
        value={Math.min(selected, periods.length - 1)} aria-valuetext={`${displayInstant(current.from)}: ${cash(current.effectivePrice)}`}
        onChange={event => setSelected(Number(event.target.value))} /></label>
    </div>}
    <p className="statistics-help">Los escalones marcan cambios de precio. El fondo verde indica una oferta. Los cupones pueden reducir aún más lo pagado en una compra.</p>
    {periods.length > 0 && <details className="statistics-table-details"><summary>Ver detalle de precios</summary>
      <div className="statistics-table-wrap"><table><caption>Precios durante el período consultado. Horarios de Argentina.</caption>
        <thead><tr><th scope="col">Vigente desde</th><th scope="col">Hasta</th><th scope="col">Lista</th><th scope="col">Publicado</th><th scope="col">Detalle</th></tr></thead>
        <tbody>{shown.map((p, index) => <tr key={`${p.from}-${index}`}><td>{displayInstant(p.from)}</td><td>{displayInstant(p.to)}<span className="statistics-table-note">Hasta ese instante, sin incluirlo</span></td><td>{cash(p.listPrice)}</td><td><strong>{cash(p.effectivePrice)}</strong>{p.offerPrice !== null && <span className="statistics-table-note">Con oferta</span>}</td><td>{reasonLabel(p.reason)}</td></tr>)}</tbody>
      </table></div>
      {periods.length > 8 && <nav className="statistics-pagination" aria-label="Páginas del detalle de precios"><button type="button" className="btn-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>{page} de {Math.ceil(periods.length / 8)}</span><button type="button" className="btn-secondary" disabled={page * 8 >= periods.length} onClick={() => setPage(page + 1)}>Siguiente</button></nav>}
    </details>}
  </section>;
}
