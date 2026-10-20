import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/context/useAuth.js';
import { useCart } from '../../cart/context/useCart.js';
import { getMyPurchases, getMyPendingPurchases, getDownload } from '../api/orders';
import useResource from '../../../shared/hooks/useResource';
import { sortPurchases } from '../model/purchaseSort.js';

const EMPTY_PURCHASES = Object.freeze([]);

export default function usePurchases() {
  const { customerId } = useAuth();
  const { settleCheckout } = useCart();
  const [activeTab, setActiveTab] = useState('approved');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('created-desc');
  const loader = useCallback(options => !customerId ? Promise.resolve([])
    : activeTab === 'approved' ? getMyPurchases(options) : getMyPendingPurchases(options), [activeTab, customerId]);
  const { data, loading, error } = useResource(loader, EMPTY_PURCHASES);
  const purchases = loading || error ? EMPTY_PURCHASES : data;
  const sortedPurchases = useMemo(() => sortPurchases(purchases, sort), [purchases, sort]);
  useEffect(() => {
    for (const purchase of purchases)
      if (['APPROVED', 'PAID_REQUIRES_REVIEW'].includes(purchase.status)) settleCheckout(purchase.orderId, customerId);
  }, [purchases, customerId, settleCheckout]);
  const pages = Math.max(1, Math.ceil(purchases.length / 6));
  const currentPage = Math.min(pages, Math.max(1, page));
  const pagination = { page: currentPage, pages, items: sortedPurchases.slice((currentPage - 1) * 6, currentPage * 6) };
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
  return { activeTab, purchases, pagination, setPage, sort, changeSort: value => { setSort(value); setPage(1); }, loading, error, downloadError, ticketDownloading, downloadTicket,
    switchTab: tab => { setActiveTab(tab); setPage(1); setDownloadError(''); }, download };
}
