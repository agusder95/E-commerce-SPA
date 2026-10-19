import { useState } from 'react';
import { IconDownload } from '@tabler/icons-react';
import { MP_CHECKOUT_URL, purchaseStatusLabel } from '../model/orderStatus.js';
import { purchaseReceipt } from '../model/receipt.js';
import { money } from '../../../shared/utils/format.js';
import Tabs from '../../../shared/ui/Tabs.jsx';
import PurchaseReceipt from './PurchaseReceipt.jsx';

export default function PurchaseCard({ purchase, onDownload, onDownloadTicket, ticketDownloading }) {
  const digitalItems = purchase.items.filter(item => item.productType === 'DIGITAL');
  const [section, setSection] = useState(digitalItems.length ? 'downloads' : 'ticket');
  const receipt = purchaseReceipt(purchase);
  const approved = purchase.status === 'APPROVED';
  return <article className="purchase-card customer-purchase-card">
    <details>
      <summary className="customer-purchase-summary">
        <span className="customer-purchase-title"><strong>Compra #{purchase.orderId}</strong><time dateTime={purchase.createdAt}>{receipt.date}</time></span>
        <span className="purchase-header-right"><span className={`purchase-status status-${purchase.status?.toLowerCase()}`}>{purchaseStatusLabel(purchase.status)}</span><strong>{money(receipt.total, 2)}</strong></span>
        <span className="customer-purchase-toggle"><span className="customer-purchase-show">Ver compra</span><span className="customer-purchase-hide">Cerrar compra</span></span>
      </summary>
      <div className="customer-purchase-content">
        <Tabs label={`Secciones de la compra ${purchase.orderId}`} options={[["downloads", "Descargas"], ["ticket", "Ticket"]]} value={section} onChange={setSection} />
        {section === 'downloads' ? <section aria-label={`Descargas de la compra ${purchase.orderId}`}>
          {!approved && <p className="purchase-download-notice">{purchase.status === 'CANCELLED' ? 'Esta compra está cancelada. Las descargas no están habilitadas.'
            : 'Las descargas estarán disponibles cuando el pago esté aprobado.'}</p>}
          {!digitalItems.length ? <p>Esta compra contiene productos físicos y no tiene archivos para descargar.</p>
            : <ul className="purchase-items">{digitalItems.map(item => <li key={item.orderItemId}>
              <strong>{item.productName}</strong>
              {approved && item.downloadUrl ? <div className="purchase-downloads">{(item.files?.length ? item.files : [{ index: 0, name: item.productName }]).map(file =>
                <button key={file.index} type="button" className="resend-button media-action" onClick={() => onDownload(item.orderItemId, file.index)}>
                  <IconDownload size={18} aria-hidden="true" />Descargar {file.name}
                </button>)}</div> : approved ? <p>El archivo todavía no está disponible. Contactanos para recibir ayuda.</p> : null}
            </li>)}</ul>}
          {purchase.items.some(item => item.productType === 'PHYSICAL') && <p className="purchase-download-notice">Los productos físicos se entregan de manera presencial. Coordiná la entrega con la tienda.</p>}
        </section> : <section className="purchase-ticket-section" aria-label={`Ticket de la compra ${purchase.orderId}`}>
          <button type="button" className="btn-secondary media-action receipt-download" disabled={ticketDownloading != null} onClick={() => onDownloadTicket(purchase)}>
            <IconDownload size={18} aria-hidden="true" />{ticketDownloading === purchase.orderId ? 'Generando ticket…' : 'Descargar ticket en PDF'}
          </button>
          <PurchaseReceipt purchase={purchase} />
        </section>}
        {['PENDING_PAYMENT', 'Pending'].includes(purchase.status) && purchase.mercadoPagoPreferenceId &&
          <div className="purchase-actions"><button type="button" className="btn-pay"
            onClick={() => window.open(MP_CHECKOUT_URL + encodeURIComponent(purchase.mercadoPagoPreferenceId), '_blank', 'noopener,noreferrer')}>Continuar con el pago</button></div>}
      </div>
    </details>
  </article>;
}
