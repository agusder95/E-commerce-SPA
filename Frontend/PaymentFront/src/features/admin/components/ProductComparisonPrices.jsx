import { useId, useState } from 'react';
import { money } from '../../../shared/utils/format.js';
import { axisMoney, chartCeiling, displayDate, displayInstant, priceGeometry, productLabel } from '../model/statistics.js';
import { comparisonPriceRows } from '../model/productComparison.js';
import useChartWidth from '../hooks/useChartWidth';
import ComparisonLegend from './ComparisonLegend.jsx';

export default function ProductComparisonPrices({ series, query }) {
  const [container, width] = useChartWidth();
  const [selected, setSelected] = useState(0);
  const [page, setPage] = useState(1);
  const titleId = useId();
  const sliderId = useId();
  const rows = comparisonPriceRows(series);
  const ceiling = chartCeiling(Math.max(1, ...rows.flatMap(row => [row.listPrice, row.effectivePrice])));
  const geometry = priceGeometry([], query, width, 220, ceiling);
  const { x, y } = geometry;
  const instants = [...new Set(rows.flatMap(row => [row.from, row.to]))].sort();
  const current = instants[Math.min(selected, Math.max(0, instants.length - 2))];
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 12)));
  const shown = rows.slice((currentPage - 1) * 12, currentPage * 12);
  return <section className="statistics-chart-card" aria-labelledby={titleId}>
    <div className="statistics-chart-heading"><div><h3 id={titleId}>Comparación de precios</h3><p>Línea continua: precio con ofertas. Línea punteada: precio de lista.</p></div></div>
    <ComparisonLegend products={series.map(item => item.product)} />
    <p className="statistics-help">Los tramos sin historial quedan vacíos. Los cupones no forman parte del precio publicado.</p>
    <div ref={container} className="statistics-plot">{rows.length > 0 ? <svg width={width} height="220" viewBox={`0 0 ${width} 220`} role="img" aria-label="Comparación de precios por producto, con la misma escala y las mismas fechas. Consultá los valores exactos en el detalle.">
      {[0, 0.5, 1].map(fraction => <g key={fraction}><line x1="75" x2={width - 20} y1={y(ceiling * fraction)} y2={y(ceiling * fraction)} className="statistics-gridline" />
        <text x="65" y={y(ceiling * fraction) + 4} textAnchor="end">{axisMoney(ceiling * fraction)}</text></g>)}
      {series.map(item => {
        const paths = priceGeometry(item.data?.periods || [], query, width, 220, ceiling);
        return <g key={item.product.id}><path d={paths.listPath} fill="none" stroke={item.product.color} strokeWidth="1.5" strokeDasharray="5 4"><title>{productLabel(item.product)} · Lista</title></path>
          <path d={paths.effectivePath} fill="none" stroke={item.product.color} strokeWidth="2.5"><title>{productLabel(item.product)} · Con ofertas</title></path></g>;
      })}
      {series.flatMap((item, productIndex) => (item.data?.periods || []).map(period => <circle key={`${item.product.id}-${period.from}`}
        cx={x(period.from) + (x(period.to) - x(period.from)) * (productIndex + 1) / (series.length + 1)} cy={y(period.effectivePrice)} r="3.5"
        fill={item.product.color} stroke="white" strokeWidth="1"><title>{productLabel(item.product)}: {money(period.effectivePrice, 2)}</title></circle>))}
      {current && <line x1={x(current)} x2={x(current)} y1="20" y2="190" stroke="#707770" strokeDasharray="2 3" />}
      {instants.slice(0, -1).map((instant, index) => <rect key={instant} x={x(instant)} y="18" width={Math.max(1, x(instants[index + 1]) - x(instant))} height="174" fill="transparent"
        onPointerEnter={() => setSelected(index)} onClick={() => setSelected(index)}><title>{displayInstant(instant)}</title></rect>)}
      <text x="75" y="215">{displayDate(query.from, true)}</text><text x={width - 20} y="215" textAnchor="end">{displayDate(query.to, true)}</text>
    </svg> : <p className="statistics-inline-note">No hay precios registrados para los productos en este período.</p>}</div>
    {current && <div className="statistics-chart-detail comparison-detail"><div><strong>{displayInstant(current)}</strong>{series.map(item => {
      const period = item.data?.periods.find(period => Date.parse(period.from) <= Date.parse(current) && Date.parse(period.to) > Date.parse(current));
      return <span key={item.product.id}><i className="statistics-color-dot" style={{ background: item.product.color }} aria-hidden="true" />{productLabel(item.product)}:
        {' '}{item.error ? 'Consulta no disponible' : period ? `${money(period.effectivePrice, 2)} · Lista: ${money(period.listPrice, 2)}` : 'Sin precio registrado en ese instante'}</span>;
    })}</div><label htmlFor={sliderId}>Explorar cambios de precio<input id={sliderId} type="range" min="0" max={Math.max(0, instants.length - 2)} disabled={instants.length <= 2}
      value={Math.min(selected, Math.max(0, instants.length - 2))} aria-valuetext={displayInstant(current)} onChange={event => setSelected(Number(event.target.value))} /></label></div>}
    {rows.length > 0 && <details className="statistics-table-details"><summary>Ver comparación de precios en una tabla</summary><div className="statistics-table-wrap"><table>
      <caption>Precios históricos de cada producto. Horarios de Argentina. El final de cada tramo es exclusivo.</caption>
      <thead><tr><th scope="col">Producto</th><th scope="col">Desde</th><th scope="col">Hasta</th><th scope="col">Lista</th><th scope="col">Publicado</th></tr></thead>
      <tbody>{shown.map(row => <tr key={`${row.product.id}-${row.from}`}><th scope="row"><i className="statistics-color-dot" style={{ background: row.product.color }} aria-hidden="true" />{productLabel(row.product)}</th>
        <td>{displayInstant(row.from)}</td><td>{displayInstant(row.to)}</td><td>{money(row.listPrice, 2)}</td><td><strong>{money(row.effectivePrice, 2)}</strong>{row.offerPrice !== null && <span className="statistics-table-note">Con oferta</span>}</td></tr>)}</tbody>
    </table></div>{rows.length > 12 && <nav className="statistics-pagination" aria-label="Páginas de comparación de precios"><button type="button" className="btn-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button>
      <span>{currentPage} de {Math.ceil(rows.length / 12)}</span><button type="button" className="btn-secondary" disabled={currentPage * 12 >= rows.length} onClick={() => setPage(currentPage + 1)}>Siguiente</button></nav>}</details>}
  </section>;
}
