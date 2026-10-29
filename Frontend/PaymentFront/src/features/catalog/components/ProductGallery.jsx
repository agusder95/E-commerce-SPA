import { useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconZoomIn } from '@tabler/icons-react';
import { productImages } from '../model/product';
import ProductCover from './ProductCover';
import ImageLightbox from './ImageLightbox';

export default function ProductGallery({ product }) {
  const images = productImages(product);
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  if (!images.length) return <ProductCover product={product} hero />;
  function move(direction) { setIndex(value => (value + direction + images.length) % images.length); }
  return <div className="product-image-gallery">
    <div className="product-gallery-cover">
      <button type="button" className="product-cover cover-hero" aria-label={`Ampliar imagen de ${product.name}`} onClick={() => setExpanded(true)}>
        <img src={images[index]} alt={`${product.name}, imagen ${index + 1}`} loading="eager" />
        <span className="gallery-expand"><IconZoomIn size={18} aria-hidden="true" />Ampliar</span>
      </button>
      {images.length > 1 && <>
        <button type="button" className="gallery-arrow gallery-arrow-left" aria-label="Imagen anterior" onClick={() => move(-1)}><IconChevronLeft aria-hidden="true" /></button>
        <button type="button" className="gallery-arrow gallery-arrow-right" aria-label="Imagen siguiente" onClick={() => move(1)}><IconChevronRight aria-hidden="true" /></button>
      </>}
    </div>
    {images.length > 1 && <div className="product-gallery" role="group" aria-label="Miniaturas del producto">
      {images.map((url, imageIndex) => <button key={url} type="button" aria-label={`Ver imagen ${imageIndex + 1}`}
        aria-pressed={index === imageIndex} onClick={() => setIndex(imageIndex)}>
        <img src={url} alt="" loading="lazy" />
      </button>)}
    </div>}
    <p className="gallery-position" aria-live="polite">Imagen {index + 1} de {images.length}</p>
    {expanded && <ImageLightbox images={images} index={index} name={product.name} onIndex={setIndex} onClose={() => setExpanded(false)} />}
  </div>;
}
