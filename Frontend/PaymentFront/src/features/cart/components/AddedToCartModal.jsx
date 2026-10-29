import { useEffect } from 'react';
import ConfirmDialog from '../../../shared/ui/ConfirmDialog.jsx';

export default function AddedToCartModal({ productName, onClose, onGoToCart }) {
  useEffect(() => {
    const timeout = setTimeout(onClose, 5000);
    return () => clearTimeout(timeout);
  }, [onClose]);

  return <ConfirmDialog title="Producto agregado al carrito" cancelLabel="Seguir comprando"
    confirmLabel="Ir al carrito" onCancel={onClose} onConfirm={onGoToCart}>
    <p>Agregaste una unidad de <strong>{productName}</strong> a tu carrito.</p>
    <p>Este mensaje se cerrará automáticamente en 5 segundos.</p>
  </ConfirmDialog>;
}
