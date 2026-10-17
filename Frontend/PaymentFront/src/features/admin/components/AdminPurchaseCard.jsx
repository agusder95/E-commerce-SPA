import { money as formatMoney } from '../../../shared/utils/format.js';
import { orderStatusLabel, purchaseAmounts } from '../model/purchases.js';

const money = value => formatMoney(value, 2);

export default function AdminPurchaseCard({ order, busy, onChangeStatus }) {
  const amounts = purchaseAmounts(order);
  const date = new Date(order.datePurchase).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return <article className="purchase-card admin-purchase-card">
    <details>
      <summary className="admin-purchase-summary">
        <span className="admin-purchase-heading"><strong>Orden #{order.idOrder}</strong><span>{order.email}</span></span>
        <span className="admin-purchase-meta"><span className="purchase-status">{orderStatusLabel(order.status)}</span><strong>{money(order.totalAmount)}</strong><time dateTime={order.datePurchase}>{date}</time></span>
        <span className="admin-purchase-toggle"><span className="admin-purchase-show">Ver detalles</span><span className="admin-purchase-hide">Ocultar detalles</span></span>
      </summary>
      <div className="admin-purchase-detail">
        <h3>Detalle de la compra</h3>
        <ul className="admin-purchase-items">{order.items.map((item, index) => <li key={item.idOrderItem ?? index}>
          <div><strong>{item.productName}</strong><p>{item.productType === 'PHYSICAL' ? 'Producto físico' : 'Producto digital'} · Cantidad: {item.quantity}</p>
            <p>Precio original por unidad: {money(item.originalUnitPrice ?? item.finalPrice)}</p>
            <p>Precio final por unidad: {money(item.finalPrice)}</p></div>
          <strong>{money(item.finalPrice * item.quantity)}</strong>
        </li>)}</ul>
        <dl className="admin-purchase-totals">
          <div><dt>Subtotal sin descuentos</dt><dd>{money(amounts.subtotal)}</dd></div>
          <div><dt>Descuentos en productos y cupón</dt><dd>−{money(amounts.discount)}</dd></div>
          <div><dt>Cupón utilizado</dt><dd>{order.couponCodeUsed || 'No se utilizó cupón'}</dd></div>
          <div className="admin-purchase-total"><dt>Total de la compra</dt><dd>{money(amounts.total)}</dd></div>
        </dl>
        {order.manuallyCancelled && <p>Cancelada manualmente. Estado al restaurar: {orderStatusLabel(order.previousStatus || 'PENDING_PAYMENT')}.</p>}
        {order.items.some(item => item.productType === 'PHYSICAL') && <p>Entrega de productos físicos: retiro presencial a coordinar.</p>}
      </div>
    </details>
    <div className="purchase-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={() => onChangeStatus(order)}>
      {order.status === 'CANCELLED' ? 'Restaurar orden' : 'Cancelar orden'}
    </button></div>
  </article>;
}
