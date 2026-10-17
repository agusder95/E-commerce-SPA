import { IconChartBar, IconInfoCircle } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { money } from '../../../shared/utils/format.js';
import useProductStatistics from '../hooks/useProductStatistics';
import { displayDate, integer, productLabel } from '../model/statistics.js';
import StatisticsFilters from './StatisticsFilters';
import ProductSalesChart from './ProductSalesChart';
import ProductPriceChart from './ProductPriceChart';
import ProductSalesTable from './ProductSalesTable';
import ComparisonLegend from './ComparisonLegend.jsx';
import ProductComparisonSales from './ProductComparisonSales.jsx';
import ProductComparisonPrices from './ProductComparisonPrices.jsx';

function QueryError({ message, retry }) {
  return <div className="statistics-query-error" role="alert"><p>{message}</p><button type="button" className="btn-secondary" onClick={retry}>Reintentar</button></div>;
}

export default function ProductStatistics() {
  const state = useProductStatistics();
  const { query, sales, prices, retry } = state;
  const resultKey = query ? JSON.stringify(query) : '';
  const multiple = query?.products.length > 1;
  const successfulSales = sales.data?.filter(item => item.data) || [];
  const successfulPrices = prices.data?.filter(item => item.data) || [];
  return <section className="admin-panel product-statistics" aria-labelledby="product-statistics-title">
    <div className="statistics-section-heading"><span className="statistics-eyebrow">MIRÁ CÓMO LE VA A CADA PRODUCTO</span><h2 id="product-statistics-title">Ventas y precios</h2><p>Buscá y elegí hasta 3 productos para comparar sus ventas y precios en el mismo período.</p></div>
    {state.productsError ? <QueryError message={`No pudimos cargar los productos. ${state.productsError}`} retry={state.retryProducts} /> : <StatisticsFilters {...state} />}
    {!query && !state.productsError && <div className="statistics-welcome"><IconChartBar size={34} stroke={1.4} aria-hidden="true" />
      {!state.productsLoading && !state.products.length ? <><h3>Todavía no hay productos para consultar</h3><p>Agregá tu primer producto para empezar a registrar sus precios y ventas.</p><Link className="btn-secondary" to="/admin/products">Ir a Productos</Link></>
        : <><h3>Tu próxima consulta empieza acá</h3><p>Elegí entre 1 y 3 productos y presioná «Ver estadísticas». Cada producto tendrá su propio color.</p></>}
    </div>}
    {query && <div className="statistics-results">
      <header className="statistics-result-heading"><div><span className="statistics-eyebrow">RESULTADO DE LA CONSULTA</span><h3>{multiple ? 'Comparación de productos' : productLabel(query.products[0])}</h3><p>{displayDate(query.from)} al {displayDate(query.to)}</p></div><span className="statistics-time-zone">Fechas de Argentina · ARS</span></header>
      <ComparisonLegend products={query.products} />
      {sales.loading ? <div className="statistics-loading" role="status">Consultando las ventas…</div> : <>
        {sales.error && <QueryError message={`No pudimos consultar las ventas. ${sales.error}`} retry={retry} />}
        {sales.data?.filter(item => item.error).map(item => <QueryError key={item.product.id} message={`Ventas de ${productLabel(item.product)}: ${item.error}`} retry={retry} />)}
        {successfulSales.length > 0 && <>
          <div className="statistics-table-wrap comparison-summary"><table><caption>Totales por producto durante el período seleccionado. Importes después de ofertas y cupones.</caption>
            <thead><tr><th scope="col">Producto</th><th scope="col">Unidades vendidas</th><th scope="col">Importe vendido</th><th scope="col">Promedio por unidad</th></tr></thead>
            <tbody>{successfulSales.map(({ product, data }) => <tr key={product.id}><th scope="row"><i className="statistics-color-dot" style={{ background: product.color }} aria-hidden="true" />{productLabel(product)}</th>
              <td><strong>{integer(data.quantity)}</strong></td><td><strong>{money(data.revenue, 2)}</strong></td><td>{data.averageUnitPrice === null ? 'Sin ventas' : money(data.averageUnitPrice, 2)}</td></tr>)}</tbody>
          </table></div>
          {successfulSales.filter(item => item.data.excludedOrdersWithoutApprovalDate > 0).map(({ product, data }) => <div key={product.id} className="statistics-data-note"><IconInfoCircle size={20} aria-hidden="true" />
            <p>{productLabel(product)}: {integer(data.excludedOrdersWithoutApprovalDate)} compras aprobadas sin fecha conocida. No se incluyen en los totales del período.</p></div>)}
          {multiple ? <ProductComparisonSales key={`sales-${resultKey}`} series={sales.data || []} query={query} /> : <>
            <ProductSalesChart key={`sales-${resultKey}`} data={successfulSales[0].data} query={query} color={query.products[0].color} />
            <ProductSalesTable key={`table-${resultKey}`} data={successfulSales[0].data} query={query} /></>}
        </>}
      </>}
      {prices.loading ? <div className="statistics-loading" role="status">Consultando los historiales de precios…</div> : <>
        {prices.error && <QueryError message={`No pudimos consultar los precios. ${prices.error}`} retry={retry} />}
        {prices.data?.filter(item => item.error).map(item => <QueryError key={item.product.id} message={`Precios de ${productLabel(item.product)}: ${item.error}`} retry={retry} />)}
        {multiple && successfulPrices.filter(item => item.data.hasUnknownPrices).map(item => <p className="statistics-inline-note" key={item.product.id}>
          {productLabel(item.product)}: {item.data.coverageStartsAt ? 'el historial cubre solo una parte del período; los tramos sin datos quedan vacíos.' : 'no hay precios registrados en el período.'}</p>)}
        {successfulPrices.length > 0 && (multiple ? <ProductComparisonPrices key={`prices-${resultKey}`} series={prices.data || []} query={query} />
          : <ProductPriceChart key={`prices-${resultKey}`} data={successfulPrices[0].data} query={query} color={query.products[0].color} />)}
      </>}
      <p className="statistics-footnote">Las ventas se cuentan en la fecha de aprobación del pago. Las compras pendientes o canceladas quedan fuera del cálculo.</p>
    </div>}
  </section>;
}
