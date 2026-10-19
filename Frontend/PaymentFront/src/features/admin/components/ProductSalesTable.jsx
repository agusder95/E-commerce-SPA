import { useState } from 'react';
import { money } from '../../../shared/utils/format.js';
import { integer, periodLabel } from '../model/statistics.js';

export default function ProductSalesTable({ data, query }) {
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const periods = data.periods.slice((page - 1) * pageSize, page * pageSize);
  return <details className="statistics-table-details statistics-sales-table"><summary>Ver ventas en una tabla</summary>
    <div className="statistics-table-wrap"><table><caption>Ventas aprobadas de este producto dentro de las fechas seleccionadas.</caption>
      <thead><tr><th scope="col">Período</th><th scope="col">Unidades</th><th scope="col">Importe vendido</th><th scope="col">Precio promedio por unidad</th></tr></thead>
      <tbody>{periods.map(period => <tr key={period.periodStart}><th scope="row">{periodLabel(period.periodStart, query)}</th><td>{integer(period.quantity)}</td><td>{money(period.revenue, 2)}</td><td>{period.averageUnitPrice === null ? 'Sin ventas' : money(period.averageUnitPrice, 2)}</td></tr>)}</tbody>
      <tfoot><tr><th scope="row">Total del período</th><td>{integer(data.quantity)}</td><td>{money(data.revenue, 2)}</td><td>{data.averageUnitPrice === null ? 'Sin ventas' : money(data.averageUnitPrice, 2)}</td></tr></tfoot>
    </table></div>
    {data.periods.length > pageSize && <nav className="statistics-pagination" aria-label="Páginas de ventas por período"><button type="button" className="btn-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>{page} de {Math.ceil(data.periods.length / pageSize)}</span><button type="button" className="btn-secondary" disabled={page * pageSize >= data.periods.length} onClick={() => setPage(page + 1)}>Siguiente</button></nav>}
  </details>;
}
