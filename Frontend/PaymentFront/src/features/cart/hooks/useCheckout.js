import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/context/useAuth';
import { createOrder } from '../../orders/api/orders';
import { cartTotals } from '../model/totals.js';
import { unavailableCartProducts } from '../model/stock.js';
import { getProducts } from '../../catalog/api/products';
import { useCart } from '../context/useCart.js';
import useCartCoupon from './useCartCoupon.js';
import { trackCheckout } from '../storage/checkouts.js';

export default function useCheckout(cart) {
  const { isAuthenticated, customerId } = useAuth();
  const navigate = useNavigate();
  const { remove } = useCart();
  const coupon = useCartCoupon(cart);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState([]);
  const [checkingStock, setCheckingStock] = useState(false);
  const submitting = useRef(false);
  const hasPhysical = cart.some(item => item.type === "PHYSICAL");

  const localTotals = cartTotals(cart);
  const subtotal = coupon.appliedCoupon?.subtotal ?? localTotals.subtotal;
  const discount = coupon.appliedCoupon?.productDiscount ?? localTotals.discount;
  const total = coupon.appliedCoupon?.total ?? localTotals.total;

  async function handleCheckout() {
    if (submitting.current || coupon.couponChecking) return;
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    setError('');
    submitting.current = true;
    let paymentTab;

    const orderData = {
      couponCode: coupon.appliedCoupon?.code || null,
      items: cart.map((item) => ({
        idProduct: item.id,
        quantity: item.quantity,
      })),
    };

    setLoading(true);
    setCheckingStock(hasPhysical);
    try {
      if (hasPhysical) {
        const unavailable = unavailableCartProducts(cart, await getProducts());
        if (unavailable.length) {
          setUnavailable(unavailable);
          unavailable.forEach(item => remove(item.id));
          return;
        }
      }
      setCheckingStock(false);
      paymentTab = window.open('about:blank', '_blank');
      if (!paymentTab) throw new Error('Permití abrir nuevas pestañas para continuar con Mercado Pago.');
      paymentTab.opener = null;
      paymentTab.document.title = 'Preparando pago';
      paymentTab.document.body.textContent = 'Preparando tu pago en Mercado Pago…';
      const res = await createOrder(orderData);
      trackCheckout(res.orderId, customerId, cart);
      if (!paymentTab.closed) paymentTab.location.replace(res.initPointUrl);
      navigate(`/checkout/result?orderId=${encodeURIComponent(res.orderId)}`);
    } catch (err) {
      paymentTab?.close();
      const ids = err.details?.productIds || err.details?.ProductIds || [];
      const unavailable = err.code === 'PRODUCTS_UNAVAILABLE' ? cart.filter(item => ids.includes(item.id)) : [];
      if (unavailable.length) {
        setUnavailable(unavailable);
        unavailable.forEach(item => remove(item.id));
      } else setError(err.message);
    } finally {
      submitting.current = false;
      setCheckingStock(false);
      setLoading(false);
    }
  }


  return { ...coupon, couponDiscount: coupon.appliedCoupon?.couponDiscount ?? 0,
    loading, checkingStock, error, hasPhysical, subtotal, discount, total, isAuthenticated,
    unavailable, dismissUnavailable: () => setUnavailable([]),
    onCheckout: handleCheckout };
}
