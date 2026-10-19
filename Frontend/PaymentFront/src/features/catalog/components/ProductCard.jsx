import { Link } from 'react-router-dom';
import { IconArrowUpRight, IconDiscount2 } from '@tabler/icons-react';
import ProductCover from './ProductCover.jsx';
import { money } from '../../../shared/utils/format.js';
export default function ProductCard({ product }) {
  const types = [...new Set((product.variants || [product]).map(variant => variant.type))];
  return <Link to={`/products/${product.id}`} className="product-card"><ProductCover product={product} />
    <div className="product-card-info"><span className="product-category">{types.map(type => type === 'PHYSICAL' ? 'Físico' : 'Digital').join(' / ')}</span>
      <h3>{product.name}<IconArrowUpRight size={18} aria-hidden="true" /></h3>
      <div className="price">Desde {money(product.price)} <span>ARS</span></div>
      {(product.hasDiscount || product.discounted) && <span className="product-discount"><IconDiscount2 size={16} aria-hidden="true" />
        Descuento en {(product.discountedTypes || [product.type]).map(type => type === 'PHYSICAL' ? 'físico' : 'digital').join(' y ')}
      </span>}
    </div></Link>;
}
