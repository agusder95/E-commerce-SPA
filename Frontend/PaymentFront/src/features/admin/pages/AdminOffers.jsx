import useOffers from '../hooks/useOffers';
import Tabs from '../../../shared/ui/Tabs.jsx';
import Feedback from '../../../shared/ui/Feedback.jsx';
import ConfirmDialog from '../../../shared/ui/ConfirmDialog.jsx';
import OfferDiscount from '../components/OfferDiscount.jsx';
import OfferProducts from '../components/OfferProducts.jsx';
import CouponForm from '../components/CouponForm.jsx';
import CouponList from '../components/CouponList.jsx';
import { IconDiscount2, IconTicket } from '@tabler/icons-react';
import '../commerce.css';

export default function AdminOffers() {
  const m = useOffers();
  return <section className="admin-panel admin-commerce admin-offers">
    <header className="commerce-heading"><span className="commerce-heading-icon" aria-hidden="true"><IconDiscount2 size={25} /></span><div><h2>Ofertas y cupones</h2><p>Organizá los descuentos y las promociones de tu tienda.</p></div></header>
    <Tabs label="Secciones de ofertas" options={[['offers', <><IconDiscount2 size={17} aria-hidden="true" />Ofertas</>], ['coupons', <><IconTicket size={17} aria-hidden="true" />Cupones</>]]} value={m.section} disabled={m.busy} onChange={m.setSection} />
    <Feedback error={m.error} notice={m.notice} />
    {m.loading ? <p role="status">Cargando ofertas y cupones…</p> : m.section === 'offers' ? <>
      <OfferDiscount manager={m} /><OfferProducts manager={m} />
    </> : <><CouponForm manager={m} /><CouponList manager={m} /></>}
    {m.confirmation && <ConfirmDialog busy={m.busy} title={m.confirmation.remove ? '¿Eliminar las ofertas seleccionadas?' : '¿Guardar las ofertas seleccionadas?'}
      confirmLabel={m.confirmation.remove ? 'Eliminar ofertas' : 'Guardar ofertas'} onCancel={m.cancelConfirmation} onConfirm={m.confirmOffer}>
      <p className={m.confirmation.remove ? 'commerce-destructive-confirmation' : undefined}>{m.confirmation.products.length} productos. {m.confirmation.remove ? 'Volverán a su precio original.' : `Descuento: ${m.confirmation.payload.discount}% hasta ${m.expiration}.`}</p>
      <ul>{m.confirmation.products.map(product => <li key={product.id}>{product.name} ({product.type === 'PHYSICAL' ? 'Físico' : 'Digital'})</li>)}</ul>
    </ConfirmDialog>}
  </section>;
}
