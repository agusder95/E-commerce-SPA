import { Link } from 'react-router-dom';
import { IconArrowDown } from '@tabler/icons-react';

export default function HomeHero({ product }) {
  return <section className={`home-hero ${product ? '' : 'home-hero-text'}`} aria-labelledby="home-title">
    <div><h1 id="home-title">Ideas que toman forma.</h1><p>Descubrí productos físicos y digitales. Elegí el formato que va con vos.</p>
      <a className="btn-primary" href="#todos">Explorar productos<IconArrowDown size={18} aria-hidden="true" /></a>
    </div>
    {product && <Link className="home-hero-image" to={`/products/${product.id}`} aria-label={`Ver ${product.name}`}>
      <img src={product.thumbnail} alt={product.name} fetchPriority="high" /><span>{product.name}</span>
    </Link>}
  </section>;
}
