import { useRef, useState } from 'react';
import { getAdminProducts, updateProductStock } from '../../api/admin';
import { adjustStockDraft } from '../model/productStock';

export default function useProductStock({ busy, setBusy, setError, setNotice, setProducts }) {
  const [draft, setDraft] = useState({});
  const [dialog, setDialog] = useState(null);
  const submitting = useRef(false);
  const changes = Object.values(draft);

  function requestSave() {
    if (busy || !changes.length) return;
    setError(''); setNotice('');
    setDialog('save');
  }
  async function confirm() {
    if (busy || submitting.current) return;
    if (dialog === 'info') { setDialog(null); return; }
    if (dialog === 'discard') { setDraft({}); setDialog(null); return; }
    if (dialog !== 'save' || !changes.length) return;
    submitting.current = true; setBusy(true); setError(''); setNotice('');
    let saved = false;
    try {
      await updateProductStock(changes.map(({ idProduct, expectedStock, stock }) => ({ idProduct, expectedStock, stock })));
      saved = true;
      setProducts(products => products.map(product => draft[product.id] ? { ...product, stock: draft[product.id].stock } : product));
      setDraft({}); setDialog(null);
      setProducts(await getAdminProducts(true));
      setNotice('Stock actualizado correctamente.');
    } catch (error) {
      setDialog(null);
      if (error.status === 409) {
        // A conflict may follow a concurrent sale or a lost successful response: never reapply blindly.
        setDraft({});
        try { setProducts(await getAdminProducts(true)); } catch { /* Keep the conflict explanation. */ }
      }
      setError(saved ? 'El stock se guardó, pero no se pudo actualizar la lista. Recargá la página.' : error.message);
    } finally { submitting.current = false; setBusy(false); }
  }
  return { hasChanges: changes.length > 0, draft, changes, dialog, requestSave, confirm,
    showInfo: () => { if (!busy) setDialog('info'); },
    adjust: (product, amount) => { if (!busy) setDraft(previous => adjustStockDraft(previous, product, amount)); },
    discard: () => { if (!busy) setDialog('discard'); },
    dismiss: () => { if (!busy) setDialog(null); },
  };
}
