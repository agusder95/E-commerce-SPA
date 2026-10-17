import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/useCart';
import CartItem from '../components/CartItem';
import useCheckout from '../hooks/useCheckout';
import CheckoutForm from '../components/CheckoutForm';
import ConfirmDialog from '../../../shared/ui/ConfirmDialog.jsx';

export default function Cart() {
  const { cart, increment, decrement, remove } = useCart();
  const navigate = useNavigate();
  const checkout = useCheckout(cart);
  const [removing, setRemoving] = useState(null);
  const unavailableModal = checkout.unavailable.length > 0 && <ConfirmDialog title="Productos no disponibles" cancelLabel={null}
    confirmLabel="Entendido" onCancel={checkout.dismissUnavailable} onConfirm={checkout.dismissUnavailable}>
    <p>Estos productos ya no tienen stock o dejaron de estar disponibles. Los quitamos del carrito. No se inició el pago.</p>
    <ul>{checkout.unavailable.map(item => <li key={item.id}>{item.name}</li>)}</ul>
  </ConfirmDialog>;
  if (checkout.loading) return <div className="page"><section className="result-container" role="status" aria-live="polite">
    <div className="spinner" aria-hidden="true" /><h1>{checkout.checkingStock ? 'Verificando disponibilidad' : 'Preparando tu pago'}</h1>
    <p>{checkout.checkingStock ? 'Estamos comprobando el stock de tus productos.' : 'Estamos generando el pago. Mercado Pago se abrirá en la nueva pestaña.'}</p>
  </section></div>;
  if (cart.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Carrito</h1>
        <div className="cart-empty">
          <p>Tu carrito está vacío.</p>
          <button className="btn-primary" style={{ width: "auto", display: "inline-block" }} onClick={() => navigate("/")}>
            Ver productos
          </button>
        </div>
        {unavailableModal}
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Carrito</h1>
      <div className="cart-list">
        {cart.map((item) => (
          <CartItem
            key={item.id}
            item={item}
            couponItem={checkout.appliedCoupon?.items?.find(quoteItem => quoteItem.idProduct === item.id)}
            onIncrement={increment}
            onDecrement={decrement}
            onRemove={id => setRemoving(cart.find(item => item.id === id))}
          />
        ))}
      </div>
      <CheckoutForm {...checkout} />
      {unavailableModal}
      {removing && <ConfirmDialog title="¿Eliminar producto del carrito?" confirmLabel="Eliminar"
        onCancel={() => setRemoving(null)} onConfirm={() => { remove(removing.id); setRemoving(null); }}>
        <p>Se eliminará <strong>{removing.name}</strong> del carrito.</p>
      </ConfirmDialog>}
    </div>
  );
}
