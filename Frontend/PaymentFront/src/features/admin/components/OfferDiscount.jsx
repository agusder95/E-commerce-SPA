import DatePicker from '../../../shared/ui/DatePicker.jsx';
import { IconDeviceFloppy, IconTrash, IconInfoCircle } from '@tabler/icons-react';

export default function OfferDiscount({ manager: m }) {
  return <section className="offers-section offer-discount-panel" aria-labelledby="offer-discount-title"><div className="commerce-section-heading"><h3 id="offer-discount-title">Descuento</h3><p>Definí el porcentaje y hasta cuándo estará vigente.</p></div>
    <div className="product-form-grid">
      <div className="form-group"><label htmlFor="offer-discount">Porcentaje</label><input id="offer-discount" type="number" min="1" max="99" step="0.01"
        value={m.discount} disabled={m.busy} onChange={event => m.setDiscount(event.target.value)} /></div>
      <div className="form-group"><label htmlFor="offer-expiration">Fecha de expiración</label><DatePicker id="offer-expiration" required
        value={m.expiration} disabled={m.busy} onChange={m.setExpiration} /></div>
    </div>
    <p className="commerce-help"><IconInfoCircle size={18} aria-hidden="true" /><span>El descuento se calcula sobre el precio original y reemplaza cualquier oferta anterior. Válido hasta el final del día elegido.</span></p>
    {(m.discount || m.expiration) && m.offerErrors.length > 0 && <p className="offers-validation">{m.offerErrors.join(' ')}</p>}
    {m.priceError && <p className="offers-validation">{m.priceError}</p>}
    <div className="offer-selection-actions"><p role="status"><strong>{m.selectedProducts.length}</strong> productos seleccionados en total.</p>
    <div className="product-editor-actions">
      <button type="button" className="btn-primary" disabled={m.busy || !m.canSaveOffer} onClick={() => m.requestOffer(false)}><IconDeviceFloppy size={17} aria-hidden="true" />Guardar ofertas</button>
      <button type="button" className="btn-secondary commerce-danger" disabled={m.busy || !m.canRemoveOffer} onClick={() => m.requestOffer(true)}><IconTrash size={17} aria-hidden="true" />Eliminar ofertas de seleccionados</button>
    </div></div>
  </section>;
}
