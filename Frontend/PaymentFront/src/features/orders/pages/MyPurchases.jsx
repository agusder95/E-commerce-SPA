import usePurchases from '../hooks/usePurchases';
import PurchaseCard from '../components/PurchaseCard';
import Tabs from '../../../shared/ui/Tabs';
import Feedback from '../../../shared/ui/Feedback';

const tabs = [['approved', 'Aprobadas'], ['pending', 'Pendientes y otras']];
export default function MyPurchases() {
  const { activeTab, purchases, pagination, setPage, loading, error, downloadError, switchTab, download, downloadTicket, ticketDownloading } = usePurchases();
  return <div className="page">
    <h1 className="page-title">Mis compras</h1>
    <p className="my-purchases-intro">Abrí una compra para acceder a tus descargas o consultar su ticket.</p>
    <Tabs label="Estado de las compras" options={tabs} value={activeTab} onChange={switchTab} />
    <Feedback error={error || downloadError} />
    {loading ? <div className="loading" role="status">Cargando compras…</div> : !error && (purchases.length
      ? <><div className="purchases-list">{pagination.items.map(purchase => <PurchaseCard key={purchase.orderId}
        purchase={purchase} onDownload={download} onDownloadTicket={downloadTicket} ticketDownloading={ticketDownloading} />)}</div>
        {pagination.pages > 1 && <nav className="purchases-pagination" aria-label="Paginación de mis compras">
          <button type="button" className="btn-secondary" disabled={pagination.page === 1} onClick={() => setPage(pagination.page - 1)}>Anterior</button>
          <span aria-live="polite">Página {pagination.page} de {pagination.pages}</span>
          <button type="button" className="btn-secondary" disabled={pagination.page === pagination.pages} onClick={() => setPage(pagination.page + 1)}>Siguiente</button>
        </nav>}</>
      : <div className="purchases-empty"><p>{activeTab === 'approved'
        ? 'Aún no tenés compras aprobadas.' : 'No tenés compras pendientes, canceladas o por revisar.'}</p></div>)}
  </div>;
}
