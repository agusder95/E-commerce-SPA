import { useCallback, useRef, useState } from 'react';
import { getAdminOrders, changeOrderStatus } from '../api/admin';
import useResource from '../../../shared/hooks/useResource';
import { selectOrders } from '../model/purchases.js';

export default function useAdminPurchases() {
  const [revision, setRevision] = useState(0);
  const loader = useCallback(options => { void revision; return getAdminOrders(options); }, [revision]);
  const { data: orders, loading, error } = useResource(loader, []);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const submitting = useRef(false);
  const pagination = selectOrders(orders, { search, status, sort, page });
  function filter(setter, value) { setter(value); setPage(1); }
  async function confirm() {
    if (submitting.current || !confirmation) return;
    submitting.current = true; setBusy(true); setActionError(''); setNotice('');
    try {
      const result = await changeOrderStatus(confirmation.order.idOrder, confirmation.restore);
      setNotice(result.message); setConfirmation(null); setRevision(value => value + 1);
    } catch (error) {
      setActionError(error.message); setConfirmation(null); setRevision(value => value + 1);
    } finally { submitting.current = false; setBusy(false); }
  }
  return { loading, error: actionError || error, notice, search, status, sort, pagination, busy, confirmation, confirm,
    setSearch: value => filter(setSearch, value), setStatus: value => filter(setStatus, value),
    setSort: value => filter(setSort, value), setPage,
    requestChange: order => { setActionError(''); setNotice(''); setConfirmation({ order, restore: order.status === 'CANCELLED' }); },
    dismissConfirmation: () => { if (!submitting.current) setConfirmation(null); } };
}
