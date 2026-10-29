import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { validateCoupon } from '../api/coupons.js';
import { couponCartKey } from '../model/coupon.js';

export default function useCartCoupon(cart) {
  const [couponCode, setCouponCode] = useState('');
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [checkingKey, setCheckingKey] = useState(null);
  const request = useRef(null);
  const cartKey = couponCartKey(cart);
  const currentKey = useRef(cartKey);
  useLayoutEffect(() => { currentKey.current = cartKey; }, [cartKey]);
  useEffect(() => () => request.current?.abort(), []);
  const appliedCoupon = quote?.cartKey === cartKey ? quote : null;
  const couponChecking = checkingKey === cartKey;

  async function onApplyCoupon(event) {
    event.preventDefault();
    if (couponChecking || appliedCoupon || !couponCode.trim()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setCheckingKey(cartKey); setError(null);
    try {
      const result = await validateCoupon(couponCode.trim(), cart, { signal: controller.signal });
      if (!controller.signal.aborted && currentKey.current === cartKey) {
        setQuote({ ...result, cartKey }); setCouponCode(result.code);
      }
    } catch (error) {
      if (!controller.signal.aborted && currentKey.current === cartKey) setError({ key: cartKey, message: error.message });
    } finally {
      if (request.current === controller) { setCheckingKey(null); request.current = null; }
    }
  }
  function onRemoveCoupon() {
    request.current?.abort(); request.current = null;
    setCheckingKey(null); setQuote(null); setError(null); setCouponCode('');
  }
  return { couponCode, appliedCoupon, couponChecking, onApplyCoupon, onRemoveCoupon,
    couponError: error?.key === cartKey ? error.message : '',
    couponNotice: quote && !appliedCoupon ? 'El carrito cambió. Volvé a aplicar el cupón para actualizar el descuento.' : '',
    onCouponCode: value => { setCouponCode(value.toUpperCase()); setError(null); } };
}
