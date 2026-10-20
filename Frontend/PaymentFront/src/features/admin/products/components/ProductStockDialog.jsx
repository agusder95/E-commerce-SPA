import ConfirmDialog from '../../../../shared/ui/ConfirmDialog';

export default function ProductStockDialog({ editor, busy }) {
  if (!editor.dialog) return null;
  const info = editor.dialog === 'info';
  const discard = editor.dialog === 'discard';
  return <ConfirmDialog title={info ? 'Actualizar stock desde la lista' : discard ? '¿Descartar los ajustes de stock?' : '¿Guardar los cambios de stock?'}
    confirmLabel={info ? 'Entendido' : discard ? 'Descartar ajustes' : 'Guardar stock'}
    cancelLabel={info ? null : 'Seguir ajustando'} busy={busy} onCancel={editor.dismiss} onConfirm={editor.confirm}>
    {info ? <><p>Usá los botones − y + a los costados del stock para ajustar las unidades de los productos físicos.</p>
      <p>Los ajustes se conservan al buscar, ordenar o cambiar de página. Los productos digitales no requieren stock.</p>
      <p>«Actualizar stock» se habilita cuando hay al menos un producto modificado. Tocá el botón y confirmá el resumen para guardar. También podés descartar los ajustes. Podés modificar hasta 500 productos por guardado.</p></>
      : discard ? <p>Se descartarán {editor.changes.length} ajustes pendientes. El stock guardado se conservará.</p>
        : <><p>Se actualizará únicamente el stock de estos productos:</p><ul className="product-stock-summary">{editor.changes.map(item => <li key={item.idProduct}>
          <strong>{item.name}</strong><span>{item.expectedStock} → <strong>{item.stock}</strong> unidades</span>
        </li>)}</ul><p>Si el stock cambió durante una venta u otra actualización, no se guardará ningún ajuste y se solicitará revisar la lista.</p></>}
  </ConfirmDialog>;
}
