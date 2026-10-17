import useAdminPurchases from '../hooks/useAdminPurchases';
import AdminPurchaseCard from '../components/AdminPurchaseCard.jsx';
import ConfirmDialog from '../../../shared/ui/ConfirmDialog.jsx';
import { ORDER_STATUS_LABELS, ORDER_SORT_OPTIONS, orderStatusLabel } from '../model/purchases.js';

export default function AdminPurchases() {
  const m = useAdminPurchases();
  const { pagination, confirmation } = m;
  return <section className="admin-panel"><h2>Compras</h2>
    <p className="admin-purchases-intro">Consultá los detalles de cada compra y administrá sus órdenes.</p>
    <div className="admin-filters">
      <label>Buscar orden o cliente<input placeholder="Número de orden o email" value={m.search} onChange={e => m.setSearch(e.target.value)} /></label>
      <label>Estado<select value={m.status} onChange={e => m.setStatus(e.target.value)}>
        <option value="">Todos los estados</option>{Object.entries(ORDER_STATUS_LABELS).filter(([key]) => key !== 'Pending').map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <label>Ordenar por<select value={m.sort} onChange={e => m.setSort(e.target.value)}>{Object.entries(ORDER_SORT_OPTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    {m.error && <p role="alert" className="auth-message error">{m.error}</p>}
    {m.notice && <p role="status" className="auth-message success">{m.notice}</p>}
    {m.loading ? <p role="status">Cargando compras…</p> : <>
      <p className="admin-purchases-count">{pagination.total} {pagination.total === 1 ? 'orden encontrada' : 'órdenes encontradas'}</p>
      <div className="purchases-list">{pagination.items.map(order => <AdminPurchaseCard key={order.idOrder} order={order} busy={m.busy} onChangeStatus={m.requestChange} />)}
        {!pagination.total && <p>No encontramos órdenes con estos filtros.</p>}
      </div>
      {pagination.pages > 1 && <nav className="admin-purchases-pagination" aria-label="Paginación de compras">
        <button type="button" className="btn-secondary" disabled={pagination.page === 1} onClick={() => m.setPage(pagination.page - 1)}>Anterior</button>
        <span aria-live="polite">Página {pagination.page} de {pagination.pages}</span>
        <button type="button" className="btn-secondary" disabled={pagination.page === pagination.pages} onClick={() => m.setPage(pagination.page + 1)}>Siguiente</button>
      </nav>}
    </>}
    {confirmation && <ConfirmDialog title={`${confirmation.restore ? '¿Restaurar' : '¿Cancelar'} la orden #${confirmation.order.idOrder}?`}
      confirmLabel={confirmation.restore ? 'Restaurar orden' : 'Cancelar orden'} cancelLabel="Volver" busy={m.busy} onCancel={m.dismissConfirmation} onConfirm={m.confirm}>
      {confirmation.restore ? <p>La orden volverá al estado «{orderStatusLabel(confirmation.order.previousStatus || 'PENDING_PAYMENT')}». Se comprobará el stock antes de reservar los productos físicos.</p>
        : <><p>La orden quedará cancelada y se liberará el stock de los productos físicos que tenga reservado.</p>
          <p>Esta acción no genera un reembolso automático en Mercado Pago. Si el pago fue aprobado, coordiná la devolución por separado.</p></>}
    </ConfirmDialog>}
  </section>;
}
