import { money as formatMoney } from '../../../shared/utils/format.js';

const money = value => formatMoney(value, 2);

export default function CheckoutForm({
    couponCode,
    appliedCoupon,
    couponChecking,
    couponError,
    couponNotice,
    couponDiscount,
    onApplyCoupon,
    onRemoveCoupon,
    loading,
    error,
    hasPhysical,
    subtotal,
    discount,
    total,
    isAuthenticated,
    onCouponCode,
    onCheckout,
}) {
    return (
        <>
            {hasPhysical && <p>Los productos físicos se entregan de manera presencial.</p>}
            <form className="cart-coupon-form" onSubmit={onApplyCoupon}>
              <div className="form-group">
                <label htmlFor="checkout-coupon">Cupón (opcional)</label>
                <input
                    id="checkout-coupon"
                    maxLength={50}
                    disabled={loading || couponChecking || Boolean(appliedCoupon)}
                    value={couponCode}
                    onChange={(e) => onCouponCode(e.target.value)}
                    aria-describedby="cart-coupon-help"
                />
              </div>
              {appliedCoupon ? <button type="button" className="btn-secondary" disabled={loading} onClick={onRemoveCoupon}>Quitar cupón</button>
                : <button type="submit" className="btn-secondary" disabled={loading || couponChecking || !couponCode.trim()}>{couponChecking ? 'Validando…' : 'Aplicar cupón'}</button>}
            </form>
            <p id="cart-coupon-help" className="cart-summary-note">Podés aplicar un solo cupón por compra. Para usar otro, quitá el actual.</p>
            {appliedCoupon && <p role="status" className="auth-message success">Cupón {appliedCoupon.code} aplicado: ahorrás {money(couponDiscount)}.</p>}
            {couponError && <p role="alert" className="auth-message error">{couponError}</p>}
            {couponNotice && <p role="status" className="cart-summary-note">{couponNotice}</p>}
            {error && (
                <p role="alert" className="auth-message error">
                    {error}
                </p>
            )}
            <div className="cart-footer">
                <div className="cart-summary-container">
                    <dl className="cart-summary" aria-label="Resumen de importes" aria-live="polite">
                        <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
                        {discount > 0 && <div><dt>Descuentos en productos</dt><dd>−{money(discount)}</dd></div>}
                        {appliedCoupon && <div><dt>Cupón {appliedCoupon.code}</dt><dd>−{money(couponDiscount)}</dd></div>}
                        <div className="cart-total"><dt>Total</dt><dd>{money(total)}</dd></div>
                    </dl>
                    {couponCode.trim() && !appliedCoupon && <p className="cart-summary-note">Presioná “Aplicar cupón” para validarlo antes de pagar.</p>}
                </div>
                <button
                    className="btn-checkout"
                    disabled={loading || couponChecking}
                    onClick={onCheckout}
                >
                    {loading
                        ? "Preparando pago…"
                        : isAuthenticated
                          ? "Pagar con Mercado Pago"
                          : "Iniciar sesión para comprar"}
                </button>
            </div>
        </>
    );
}
