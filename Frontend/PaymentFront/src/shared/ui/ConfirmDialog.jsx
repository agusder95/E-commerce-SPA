import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmDialog({ title, children, cancelLabel = 'Cancelar', confirmLabel = 'Confirmar', busy, onCancel, onConfirm }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus({ preventScroll: true }); };
  }, []);
  return createPortal(<dialog ref={ref} className="product-confirm-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id={titleId}>{title}</h2>
    <div className="product-confirm-content">{children}</div>
    <div className="confirm-modal-actions">
      {cancelLabel && <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel} autoFocus>{cancelLabel}</button>}
      <button type="button" className="btn-primary" disabled={busy} onClick={onConfirm} autoFocus={!cancelLabel}>{busy ? 'Procesando…' : confirmLabel}</button>
    </div>
  </dialog>, document.body);
}
