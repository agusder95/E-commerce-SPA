import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/context/useAuth.js';
import usePaymentOrder from './usePaymentOrder.js';
import usePaymentExpiry from './usePaymentExpiry.js';
import { resumeCheckoutTracking } from '../../cart/storage/checkouts.js';
import { isTerminalStatus, paymentMessage, paymentTitle, MP_CHECKOUT_URL } from '../model/orderStatus';

export default function useCheckoutResult(orderId) {
  const navigate = useNavigate();
  const { customerId } = useAuth();
  const { order, error, unavailable, retrying, resume } = usePaymentOrder(orderId);
  const [openingError, setOpeningError] = useState('');
  const done = !orderId || unavailable || (isTerminalStatus(order?.status) && !retrying);
  const expiresAt = Date.parse(order?.expiresAt);
  const expired = usePaymentExpiry(expiresAt);
  const canPayAgain = !!order?.mercadoPagoPreferenceId && !expired &&
    !['APPROVED', 'PAID_REQUIRES_REVIEW', 'CANCELLED'].includes(order?.status) && !unavailable;
  const displayStatus = retrying && order?.status === 'REJECTED' ? 'PENDING_PAYMENT' : order?.status;

  useEffect(() => {
    if (order?.status !== 'APPROVED' && order?.status !== 'PAID_REQUIRES_REVIEW') return;
    if (order.status === 'APPROVED') {
      const redirect = setTimeout(() => navigate('/my-purchases'), 2000);
      return () => clearTimeout(redirect);
    }
  }, [order?.status, navigate]);

  return { done, title: orderId && !unavailable ? paymentTitle(displayStatus) : 'No encontramos el pedido',
    message: unavailable ? 'Revisá el número del pedido o volvé a tus compras.'
      : orderId ? paymentMessage(displayStatus) : 'Volvé al carrito para iniciar tu compra.', error: openingError || error,
    total: order?.totalAmount, canPayAgain,
    cancel: () => navigate('/cart'),
    payAgain: () => {
      if (!canPayAgain) return;
      if (expiresAt <= Date.now()) { setOpeningError('El plazo para pagar esta compra venció. Volvé al carrito para iniciar otra.'); return; }
      setOpeningError('');
      const paymentTab = window.open('about:blank', '_blank');
      if (!paymentTab) { setOpeningError('Permití abrir nuevas pestañas para continuar con Mercado Pago.'); return; }
      paymentTab.opener = null;
      paymentTab.location.replace(MP_CHECKOUT_URL + encodeURIComponent(order.mercadoPagoPreferenceId));
      resumeCheckoutTracking(orderId, customerId);
      resume(expiresAt);
    } };
}
