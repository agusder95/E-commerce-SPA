import { useId, useState } from 'react';
import { money } from '../../../shared/utils/format.js';
import { axisMoney, chartCeiling, displayDate, integer, periodLabel, productLabel } from '../model/statistics.js';
import { comparisonPeriods } from '../model/productComparison.js';
import useChartWidth from '../hooks/useChartWidth';
import ComparisonLegend from './ComparisonLegend.jsx';

export default function ProductComparisonSales({ series, query }) {
  const [metric, setMetric] = useState('quantity');
  const [selected, setSelected] = useState(0);
  const [page, setPage] = useState(1);
  const [container, availableWidth] = useChartWidth();
  const titleId = useId();
  const sliderId = useId();
  const periods = comparisonPeriods(series);
  if (!periods.length) return null;
  const width = Math.max(availableWidth, periods.length * series.length * 12 + 90);
  const left = metric === 'quantity' ? 44 : 75;
  const bottom = 193;
  const maximum = chartCeiling(Math.max(0, ...periods.flatMap(period => period.values.map(value => value.period?.[metric] || 0))));
  const ceiling = metric === 'quantity' ? Math.ceil(maximum) : maximum;
  const y = value => bottom - value / ceiling * 175;
  const step = (width - left - 12) / periods.length;
  const barWidth = step * 0.8 / series.length;
  const current = periods[Math.min(selected, periods.length - 1)];
  const every = Math.max(1, Math.ceil(periods.length / Math.max(3, Math.floor(width / 100))));
  const shown = periods.slice((page - 1) * 12, page * 12);
  return <section className="statistics-chart-card" aria-labelledby={titleId}>
    <div className="statistics-chart-heading"><div><h3 id={titleId}>Comparación de ventas</h3><p>Una barra por producto en cada período, con la misma escala.</p></div>
      <div className="statistics-switch" aria-label="Dato del gráfico de ventas"><button type="button" aria-pressed={metric === 'quantity'} onClick={() => setMetric('quantity')}>Unidades</button>
        <button type="button" aria-pressed={metric === 'revenue'} onClick={() => setMetric('revenue')}>Importe vendido</button></div></div>
    <ComparisonLegend products={series.map(item => item.product)} />
    <div ref={container} className="statistics-plot"><svg width={width} height="230" viewBox={`0 0 ${width} 230`} role="img" aria-label={`Comparación de ${metric === 'quantity' ? 'unidades vendidas' : 'importe vendido'} por producto y período. Los valores exactos están en el detalle y la tabla.`}>
      {[...new Set([0, metric === 'quantity' ? Math.floor(ceiling / 2) : ceiling / 2, ceiling])].map(value => <g key={value}>
        <line x1={left} x2={width - 12} y1={y(value)} y2={y(value)} className="statistics-gridline" />
        <text x={left - 8} y={y(value) + 4} textAnchor="end">{metric === 'quantity' ? integer(value) : axisMoney(value)}</text></g>)}
      {periods.map((period, index) => <g key={period.periodStart}>
        {period.values.map((value, productIndex) => value.period && <rect key={value.product.id} x={left + index * step + step * 0.1 + productIndex * barWidth}
          y={y(value.period[metric])} width={Math.max(1, barWidth - 1)} height={Math.max(0, bottom - y(value.period[metric]))} rx="2" fill={value.product.color}>
          <title>{productLabel(value.product)}: {integer(value.period.quantity)} unidades · {money(value.period.revenue, 2)}</title></rect>)}
        <rect x={left + index * step} y="18" width={step} height="175" fill="transparent" onPointerEnter={() => setSelected(index)} onClick={() => setSelected(index)}>
          <title>{periodLabel(period.periodStart, query)}</title></rect>
        {index % every === 0 && <text x={left + (index + 0.5) * step} y="217" textAnchor="middle">{displayDate(period.periodStart < query.from ? query.from : period.periodStart, true)}</text>}
      </g>)}
    </svg></div>
    {width > availableWidth && <p className="statistics-help">Deslizá horizontalmente o agrupá por semana o mes.</p>}
    <div className="statistics-chart-detail comparison-detail"><div><strong>{periodLabel(current.periodStart, query)}</strong>
      {current.values.map(value => <span key={value.product.id}><i className="statistics-color-dot" style={{ background: value.product.color }} aria-hidden="true" />{productLabel(value.product)}:
        {' '}{value.period ? `${integer(value.period.quantity)} unidades · ${money(value.period.revenue, 2)}` : 'Sin datos disponibles'}</span>)}</div>
      <label htmlFor={sliderId}>Explorar períodos<input id={sliderId} type="range" min="0" max={periods.length - 1} disabled={periods.length === 1}
        value={Math.min(selected, periods.length - 1)} aria-valuetext={periodLabel(current.periodStart, query)} onChange={event => setSelected(Number(event.target.value))} /></label></div>
    <details className="statistics-table-details"><summary>Ver comparación de ventas en una tabla</summary><div className="statistics-table-wrap"><table>
      <caption>Ventas aprobadas por producto y período. «Sin datos» indica una consulta no disponible.</caption>
      <thead><tr><th scope="col">Período</th><th scope="col">Producto</th><th scope="col">Unidades</th><th scope="col">Importe vendido</th><th scope="col">Promedio por unidad</th></tr></thead>
      <tbody>{shown.flatMap(period => period.values.map(value => <tr key={`${period.periodStart}-${value.product.id}`}>
        <th scope="row">{periodLabel(period.periodStart, query)}</th><td><i className="statistics-color-dot" style={{ background: value.product.color }} aria-hidden="true" />{productLabel(value.product)}</td>
        <td>{value.period ? integer(value.period.quantity) : 'Sin datos'}</td><td>{value.period ? money(value.period.revenue, 2) : 'Sin datos'}</td>
        <td>{!value.period ? 'Sin datos' : value.period.averageUnitPrice === null ? 'Sin ventas' : money(value.period.averageUnitPrice, 2)}</td></tr>))}</tbody>
    </table></div>{periods.length > 12 && <nav className="statistics-pagination" aria-label="Páginas de comparación de ventas">
      <button type="button" className="btn-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>{page} de {Math.ceil(periods.length / 12)}</span>
      <button type="button" className="btn-secondary" disabled={page * 12 >= periods.length} onClick={() => setPage(page + 1)}>Siguiente</button></nav>}</details>
  </section>;
}
