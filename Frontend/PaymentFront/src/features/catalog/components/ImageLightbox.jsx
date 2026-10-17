import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';

export default function ImageLightbox({ images, index, name, onIndex, onClose }) {
  const dialog = useRef(null);
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  function move(direction) {
    setZoomed(false); onIndex((index + direction + images.length) % images.length);
  }
  return createPortal(<dialog ref={dialog} className="image-lightbox" aria-label={`Galería ampliada de ${name}`}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
    }}>
    <section className="lightbox-panel">
      <div className="lightbox-toolbar"><span>{name} · {index + 1} / {images.length}</span>
        <button type="button" className="icon-button" aria-label="Cerrar galería ampliada" onClick={onClose} autoFocus><IconX aria-hidden="true" /></button>
      </div>
      <div className="lightbox-stage">
        <button type="button" className={`lightbox-image ${zoomed ? 'is-zoomed' : ''}`} aria-label={zoomed ? 'Alejar imagen' : 'Acercar imagen'}
          aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}><img src={images[index]} alt={`${name}, imagen ${index + 1}`} /></button>
        {images.length > 1 && <>
          <button type="button" className="gallery-arrow gallery-arrow-left" aria-label="Imagen anterior ampliada" onClick={() => move(-1)}><IconChevronLeft aria-hidden="true" /></button>
          <button type="button" className="gallery-arrow gallery-arrow-right" aria-label="Imagen siguiente ampliada" onClick={() => move(1)}><IconChevronRight aria-hidden="true" /></button>
        </>}
      </div>
      <p>Hacé clic en la imagen para acercar o alejar. Usá las flechas para recorrer la galería.</p>
    </section>
  </dialog>, document.body);
}
