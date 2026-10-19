import { useRef, useState } from 'react';
import { getMyPurchases, getMyPendingPurchases, getDownload } from '../api/orders';
import useResource from '../../../shared/hooks/useResource';

export default function usePurchases() {
  const [activeTab, setActiveTab] = useState('approved');
  const [page, setPage] = useState(1);
  const loader = activeTab === 'approved' ? getMyPurchases : getMyPendingPurchases;
  const { data: purchases, loading, error } = useResource(loader, []);
  const pages = Math.max(1, Math.ceil(purchases.length / 6));
  const currentPage = Math.min(pages, Math.max(1, page));
  const pagination = { page: currentPage, pages, items: purchases.slice((currentPage - 1) * 6, currentPage * 6) };
  const [downloadError, setDownloadError] = useState('');
  const [ticketDownloading, setTicketDownloading] = useState(null);
  const ticketBusy = useRef(false);
  async function downloadTicket(purchase) {
    if (ticketBusy.current) return;
    ticketBusy.current = true; setTicketDownloading(purchase.orderId); setDownloadError('');
    try {
      const { downloadReceiptPdf } = await import('../lib/receiptPdf.js');
      await downloadReceiptPdf(purchase);
    } catch { setDownloadError('No se pudo descargar el ticket. Volvé a intentarlo.'); }
    finally { ticketBusy.current = false; setTicketDownloading(null); }
  }
  async function download(id, file) {
    setDownloadError('');
    try { const { url } = await getDownload(id, file); window.location.assign(url); }
    catch (error) { setDownloadError(error.message); }
  }
  return { activeTab, purchases, pagination, setPage, loading, error, downloadError, ticketDownloading, downloadTicket,
    switchTab: tab => { setActiveTab(tab); setPage(1); setDownloadError(''); }, download };
}
