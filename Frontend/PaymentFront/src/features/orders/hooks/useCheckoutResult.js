import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../cart/context/useCart';
import { useAuth } from '../../auth/context/useAuth.js';
import { getOrderStatus, syncPayment } from '../api/orders';
import { isTerminalStatus, paymentMessage, paymentTitle, MP_CHECKOUT_URL } from '../model/orderStatus';

export default function useCheckoutResult(orderId) {
  const navigate = useNavigate();
  const { settleCheckout } = useCart();
  const { customerId } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const done = !orderId || isTerminalStatus(order?.status);
  useEffect(() => {
    if (!orderId || done) return;
    let active = true;
    let inFlight = false;
    let completed = false;
    let lastSync = null;
    const controller = new AbortController();
    let interval;
    async function poll() {
      if (inFlight || completed || !active) return;
      inFlight = true;
      try {
        if (lastSync === null || Date.now() - lastSync >= 15000) {
          lastSync = Date.now();
          try { await syncPayment(orderId, { signal: controller.signal }); }
          catch { /* El webhook puede confirmar la orden aunque falle esta consulta. */ }
        }
        const next = await getOrderStatus(orderId, { signal: controller.signal });
        if (!active) return;
        setOrder(next);
        setError('');
        completed = isTerminalStatus(next.status);
        if (completed) clearInterval(interval);
      } catch {
        if (active) setError('No pudimos actualizar el estado del pago. Volveremos a intentarlo automáticamente.');
      } finally { inFlight = false; }
    }
    interval = setInterval(poll, 3000);
    poll();
    function visible() { if (document.visibilityState === 'visible') poll(); }
    window.addEventListener('focus', poll);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false; clearInterval(interval); controller.abort();
      window.removeEventListener('focus', poll);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [orderId, done]);

  useEffect(() => {
    if (order?.status !== 'APPROVED' && order?.status !== 'PAID_REQUIRES_REVIEW') return;
    settleCheckout(orderId, customerId);
    if (order.status === 'APPROVED') {
      const redirect = setTimeout(() => navigate('/my-purchases'), 2000);
      return () => clearTimeout(redirect);
    }
  }, [order?.status, orderId, customerId, settleCheckout, navigate]);

  return { done, title: orderId ? paymentTitle(order?.status) : 'No encontramos el pedido',
    message: orderId ? paymentMessage(order?.status) : 'Volvé al carrito para iniciar tu compra.', error,
    total: order?.totalAmount, canPayAgain: !!order?.mercadoPagoPreferenceId && (!done || order.status === 'REJECTED'),
    cancel: () => navigate('/cart'),
    payAgain: () => { if (order?.mercadoPagoPreferenceId) window.open(MP_CHECKOUT_URL + order.mercadoPagoPreferenceId, '_blank', 'noopener,noreferrer'); } };
}
