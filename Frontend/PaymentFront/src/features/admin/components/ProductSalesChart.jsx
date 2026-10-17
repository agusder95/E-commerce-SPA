import { useId, useState } from 'react';
import { money } from '../../../shared/utils/format.js';
import { axisMoney, chartCeiling, displayDate, integer, periodLabel } from '../model/statistics.js';
import useChartWidth from '../hooks/useChartWidth';

const cash = value => money(value, 2);

export default function ProductSalesChart({ data, query, color }) {
  const [metric, setMetric] = useState('quantity');
  const [selected, setSelected] = useState(0);
  const [container, availableWidth] = useChartWidth();
  const titleId = useId();
  const sliderId = useId();
  const periods = data.periods;
  const width = Math.max(availableWidth, periods.length * 14 + 75);
  const height = 230;
  const left = metric === 'quantity' ? 44 : 70;
  const top = 18;
  const bottom = 193;
  const maximum = chartCeiling(Math.max(0, ...periods.map(p => p[metric])));
  const ceiling = metric === 'quantity' ? Math.ceil(maximum) : maximum;
  const ticks = [...new Set([0, metric === 'quantity' ? Math.floor(ceiling / 2) : ceiling / 2, ceiling])];
  const step = (width - left - 12) / periods.length;
  const current = periods[Math.min(selected, periods.length - 1)];
  const y = value => bottom - value / ceiling * (bottom - top);
  const labelEvery = Math.max(1, Math.ceil(periods.length / Math.max(3, Math.floor(width / 100))));
  return <section className="statistics-chart-card" aria-labelledby={titleId}>
    <div className="statistics-chart-heading">
      <div><h3 id={titleId}>¿Cuánto se vendió?</h3><p>Cada barra reúne las ventas {({ day: 'de un día', week: 'de una semana', month: 'de un mes' })[query.groupBy]}.</p></div>
      <div className="statistics-switch" aria-label="Dato del gráfico de ventas">
        <button type="button" aria-pressed={metric === 'quantity'} onClick={() => setMetric('quantity')}>Unidades</button>
        <button type="button" aria-pressed={metric === 'revenue'} onClick={() => setMetric('revenue')}>Importe vendido</button>
      </div>
    </div>
    {data.quantity === 0 && <p className="statistics-inline-note">No se registraron ventas aprobadas de este producto en el período.</p>}
    <div ref={container} className="statistics-plot">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={`${metric === 'quantity' ? 'Unidades vendidas' : 'Importe vendido en pesos'} por período. Usá el selector de detalle o la tabla para consultar valores exactos.`}>
        {ticks.map(value => <g key={value}>
          <line x1={left} x2={width - 12} y1={y(value)} y2={y(value)} className="statistics-gridline" />
          <text x={left - 8} y={y(value) + 4} textAnchor="end">{metric === 'revenue' ? axisMoney(value) : integer(value)}</text>
        </g>)}
        {periods.map((period, index) => <g key={period.periodStart}>
          <rect x={left + index * step + step * 0.18} y={y(period[metric])} width={step * 0.64}
            height={Math.max(0, bottom - y(period[metric]))} rx={Math.min(3, step * 0.12)}
            style={color ? { fill: color, opacity: index === selected ? 1 : 0.75 } : undefined}
            className={index === selected ? 'statistics-bar is-selected' : 'statistics-bar'} />
          <rect x={left + index * step} y={top} width={step} height={bottom - top} fill="transparent"
            onPointerEnter={() => setSelected(index)} onClick={() => setSelected(index)}>
            <title>{periodLabel(period.periodStart, query)}: {integer(period.quantity)} unidades · {cash(period.revenue)}</title>
          </rect>
          {(index % labelEvery === 0) && <text x={left + index * step + step / 2} y={bottom + 24} textAnchor="middle">{displayDate(period.periodStart < query.from ? query.from : period.periodStart, true)}</text>}
        </g>)}
      </svg>
    </div>
    {width > availableWidth && <p className="statistics-help">Deslizá el gráfico horizontalmente o agrupá por semana o mes para ver el período completo.</p>}
    <div className="statistics-chart-detail">
      <div><strong>{periodLabel(current.periodStart, query)}</strong><span>{integer(current.quantity)} {current.quantity === 1 ? 'unidad' : 'unidades'} · {cash(current.revenue)} vendidos</span></div>
      <label htmlFor={sliderId}>Explorar períodos<input id={sliderId} type="range" min="0" max={periods.length - 1} value={Math.min(selected, periods.length - 1)}
        disabled={periods.length === 1} aria-valuetext={`${periodLabel(current.periodStart, query)}: ${integer(current.quantity)} unidades, ${cash(current.revenue)}`}
        onChange={event => setSelected(Number(event.target.value))} /></label>
    </div>
  </section>;
}
