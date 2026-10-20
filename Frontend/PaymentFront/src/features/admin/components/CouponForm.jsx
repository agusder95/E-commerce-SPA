import DatePicker from '../../../shared/ui/DatePicker.jsx';
import { normalizeCouponCode } from '../model/offers.js';
import { IconDeviceFloppy } from '@tabler/icons-react';

export default function CouponForm({ manager: m }) {
  const form = m.couponForm;
  const global = !form.productType && !form.tagIds.length;
  return <section className="offers-section coupon-editor-panel" aria-labelledby="coupon-form-title"><div className="commerce-section-heading"><h3 id="coupon-form-title">{form.id ? `Editar cupón: ${form.code}` : 'Nuevo cupón'}</h3><p>Definí el código, el descuento y los productos alcanzados.</p></div>
    <form className="offer-form" onSubmit={m.submitCoupon}><fieldset disabled={m.busy}>
      <div className="coupon-editor-grid"><div className="coupon-data-section"><h4>Datos del cupón</h4><div className="product-form-grid">
        <div className="form-group"><label htmlFor="coupon-code">Código</label><input id="coupon-code" required maxLength={50} value={form.code}
          onChange={event => m.couponField('code', normalizeCouponCode(event.target.value))} /><p>Se guarda en mayúsculas y sin tildes.</p></div>
        <div className="form-group"><label htmlFor="coupon-discount">Porcentaje</label><input id="coupon-discount" required type="number" min="1" max="99" step="0.01" value={form.discount} onChange={event => m.couponField('discount', event.target.value)} /></div>
        <div className="form-group"><label htmlFor="coupon-expiration">Fecha de expiración (opcional)</label><DatePicker id="coupon-expiration" allowClear disabled={m.busy}
          value={form.expiration} onChange={value => m.couponField('expiration', value)} /><p>Sin fecha: no vence.</p></div>
      </div></div><div className="coupon-scope-section"><h4>Alcance y condiciones</h4>
        <div className="form-group"><label htmlFor="coupon-type">Tipo de producto</label><select id="coupon-type" value={form.productType} onChange={event => m.couponField('productType', event.target.value)}>
          <option value="">Todos los tipos</option><option value="PHYSICAL">Físico</option><option value="DIGITAL">Digital</option>
        </select></div>
      <fieldset className="offers-tag-picker"><legend>Tags alcanzados (opcional)</legend><div>{m.tags.map(tag => <label key={tag.idTag}>
        <input type="checkbox" checked={form.tagIds.includes(tag.idTag)} onChange={() => m.toggleCouponTag(tag.idTag)} />{tag.name}
      </label>)}</div></fieldset>
      <p className="coupon-scope-note">{global ? 'Alcance global: todos los productos de la tienda.' : 'Se aplica al tipo elegido y a productos con al menos uno de los tags seleccionados. Sin tags, alcanza a todos los del tipo elegido.'}</p>
      <p>En un carrito mixto, el descuento se aplica únicamente a los productos alcanzados.</p>
      <div className="coupon-conditions"><label className="coupon-active"><input type="checkbox" checked={form.isActive} onChange={event => m.couponField('isActive', event.target.checked)} />Cupón activo</label>
      <label className="coupon-active"><input type="checkbox" checked={form.cumulative} onChange={event => m.couponField('cumulative', event.target.checked)} />Acumular con ofertas</label>
      </div><p>{form.cumulative ? 'El cupón se aplica sobre el precio rebajado de los productos alcanzados.' : 'Los productos con una oferta vigente se omiten. El cupón se aplica únicamente a los demás productos alcanzados.'}</p>
      </div></div>
      {(form.code || form.discount || form.expiration) && m.formErrors.length > 0 && <p className="offers-validation">{m.formErrors.join(' ')}</p>}
      <div className="product-editor-actions"><button type="submit" className="btn-primary" disabled={!m.canSaveCoupon}><IconDeviceFloppy size={17} aria-hidden="true" />{m.busy ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Guardar cupón'}</button>
        {form.id && <button type="button" className="btn-secondary" onClick={m.resetCoupon}>Cancelar edición</button>}
      </div>
    </fieldset></form>
  </section>;
}
