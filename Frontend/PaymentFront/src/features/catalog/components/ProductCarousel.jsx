import { useId, useRef } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import ProductCard from './ProductCard';

export default function ProductCarousel({ title, description, products, emptyMessage }) {
  const track = useRef(null);
  const id = useId();
  function scroll(direction) {
    const element = track.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({ left: direction * element.clientWidth, behavior: reduced ? 'instant' : 'smooth' });
  }
  return <section className="home-section" aria-labelledby={id}>
    <div className="home-section-heading"><div><h2 id={id}>{title}</h2><p>{description}</p></div>
      {products.length > 1 && <div className="carousel-controls">
        <button type="button" className="btn-secondary" aria-label={`Anteriores en ${title}`} onClick={() => scroll(-1)}><IconChevronLeft size={20} aria-hidden="true" /></button>
        <button type="button" className="btn-secondary" aria-label={`Siguientes en ${title}`} onClick={() => scroll(1)}><IconChevronRight size={20} aria-hidden="true" /></button>
      </div>}
    </div>
    {products.length ? <div className="product-carousel" ref={track} role="region" aria-label={`Productos de ${title}`} tabIndex={0}>
      {products.map(product => <ProductCard key={product.id} product={product} />)}
    </div> : <p className="section-empty">{emptyMessage}</p>}
  </section>;
}
