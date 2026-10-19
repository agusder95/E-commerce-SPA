import { money } from '../../../shared/utils/format.js';
import { purchaseReceipt } from '../model/receipt.js';

export default function PurchaseReceipt({ purchase }) {
  const receipt = purchaseReceipt(purchase);
  return <div className="purchase-receipt" aria-label={`Ticket de la compra ${receipt.orderId}`}>
    <header className="receipt-heading"><strong className="receipt-brand">forma.</strong><h3>Comprobante de compra</h3>
      <p>Compra #{receipt.orderId}</p><p>{receipt.date}</p><p>{receipt.status}</p></header>
    <ol className="receipt-items">{receipt.items.map((item, index) => <li key={index}>
      <strong>{item.name}</strong><p>{item.type}</p>
      <div className="receipt-row"><span>{item.quantity} × {money(item.unitPrice, 2)}</span><strong>{money(item.total, 2)}</strong></div>
      {item.discount > 0 && <><p>Precio original: {money(item.originalUnitPrice, 2)} c/u</p><p>Ahorro en este producto: {money(item.discount, 2)}</p></>}
    </li>)}</ol>
    <dl className="receipt-totals">
      <div><dt>Subtotal sin descuentos</dt><dd>{money(receipt.subtotal, 2)}</dd></div>
      <div><dt>Descuentos aplicados</dt><dd>−{money(receipt.discount, 2)}</dd></div>
      <div><dt>Cupón utilizado</dt><dd>{receipt.coupon || 'Sin cupón'}</dd></div>
      <div className="receipt-total"><dt>TOTAL</dt><dd>{money(receipt.total, 2)}</dd></div>
    </dl>
    <footer className="receipt-footer"><p>{receipt.quantity} {receipt.quantity === 1 ? 'unidad' : 'unidades'}</p>
      <p>Importes expresados en pesos argentinos (ARS).</p><p>Conservá este comprobante.</p></footer>
  </div>;
}
