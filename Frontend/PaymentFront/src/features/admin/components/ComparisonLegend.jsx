import { productLabel } from '../model/statistics.js';

export default function ComparisonLegend({ products }) {
  return <div className="comparison-legend" aria-label="Colores de los productos">{products.map(product =>
    <span key={product.id}><i style={{ background: product.color }} aria-hidden="true" />{productLabel(product)}</span>)}</div>;
}
