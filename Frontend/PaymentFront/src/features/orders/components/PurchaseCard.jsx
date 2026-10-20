import { useState } from 'react';
import { IconDownload, IconChevronDown, IconPackage, IconFileDownload, IconReceipt, IconClock } from '@tabler/icons-react';
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
        <span className="customer-purchase-icon" aria-hidden="true"><IconPackage size={23} stroke={1.5} /></span>
        <span className="customer-purchase-title"><strong>Compra #{purchase.orderId}</strong><time dateTime={purchase.createdAt}><IconClock size={13} aria-hidden="true" />{receipt.date}{receipt.time !== 'Sin hora' && ` · ${receipt.time} h`}</time>
          <span className="customer-purchase-item-count">{receipt.quantity} {receipt.quantity === 1 ? 'unidad' : 'unidades'}{digitalItems.length > 0 && ' · Incluye archivos digitales'}</span></span>
        <span className="purchase-header-right"><span className={`purchase-status status-${purchase.status?.toLowerCase()}`}>{purchaseStatusLabel(purchase.status)}</span><span className="customer-purchase-amount"><span>Total de la compra</span><strong>{money(receipt.total, 2)}</strong></span></span>
        <span className="customer-purchase-toggle"><span className="customer-purchase-show">Ver compra</span><span className="customer-purchase-hide">Cerrar compra</span><IconChevronDown size={16} aria-hidden="true" /></span>
      </summary>
      <div className="customer-purchase-content">
        <Tabs label={`Secciones de la compra ${purchase.orderId}`} options={[["downloads", "Descargas"], ["ticket", "Ticket"]]} value={section} onChange={setSection} />
        {section === 'downloads' ? <section className="customer-download-section" aria-label={`Descargas de la compra ${purchase.orderId}`}>
          <div className="customer-section-heading"><IconFileDownload size={21} aria-hidden="true" /><div><h2>Tus archivos digitales</h2><p>Descargá los materiales de esta compra.</p></div></div>
          {!approved && <p className="purchase-download-notice">{purchase.status === 'CANCELLED' ? 'Esta compra está cancelada. Las descargas no están habilitadas.'
            : 'Las descargas estarán disponibles cuando el pago esté aprobado.'}</p>}
          {!digitalItems.length ? <p>Esta compra contiene productos físicos y no tiene archivos para descargar.</p>
            : <ul className="purchase-items">{digitalItems.map(item => <li key={item.orderItemId}>
              <span className="customer-file-name"><IconFileDownload size={20} aria-hidden="true" /><strong>{item.productName}</strong></span>
              {approved && item.downloadUrl ? <div className="purchase-downloads">{(item.files?.length ? item.files : [{ index: 0, name: item.productName }]).map(file =>
                <button key={file.index} type="button" className="resend-button media-action" onClick={() => onDownload(item.orderItemId, file.index)}>
                  <IconDownload size={18} aria-hidden="true" />Descargar {file.name}
                </button>)}</div> : approved ? <p>El archivo todavía no está disponible. Contactanos para recibir ayuda.</p> : null}
            </li>)}</ul>}
          {purchase.items.some(item => item.productType === 'PHYSICAL') && <p className="purchase-download-notice">Los productos físicos se entregan de manera presencial. Coordiná la entrega con la tienda.</p>}
        </section> : <section className="purchase-ticket-section" aria-label={`Ticket de la compra ${purchase.orderId}`}>
          <div className="customer-ticket-info"><div className="customer-section-heading"><IconReceipt size={22} aria-hidden="true" /><div><h2>Ticket de compra</h2><p>El detalle de tus productos y los descuentos aplicados.</p></div></div>
          <button type="button" className="btn-secondary media-action receipt-download" disabled={ticketDownloading != null} onClick={() => onDownloadTicket(purchase)}>
            <IconDownload size={18} aria-hidden="true" />{ticketDownloading === purchase.orderId ? 'Generando ticket…' : 'Descargar ticket en PDF'}
          </button>
          <p className="customer-ticket-note">Guardá una copia para consultar tu compra cuando la necesites.</p></div>
          <PurchaseReceipt purchase={purchase} />
        </section>}
        {['PENDING_PAYMENT', 'Pending'].includes(purchase.status) && purchase.mercadoPagoPreferenceId &&
          <div className="purchase-actions"><button type="button" className="btn-pay"
            onClick={() => window.open(MP_CHECKOUT_URL + encodeURIComponent(purchase.mercadoPagoPreferenceId), '_blank', 'noopener,noreferrer')}>Continuar con el pago</button></div>}
      </div>
    </details>
  </article>;
}
