import { useSearchParams } from 'react-router-dom';
import useCheckoutResult from '../hooks/useCheckoutResult';
import { returnOrderId } from '../model/orderStatus';
import { money } from '../../../shared/utils/format.js';

export default function CheckoutResult() {
  const [params] = useSearchParams();
  const orderId = returnOrderId(params);
  return <CheckoutResultContent key={orderId} orderId={orderId} />;
}
function CheckoutResultContent({ orderId }) {
  const { done, title, message, error, total, canPayAgain, cancel, payAgain } = useCheckoutResult(orderId);
  return (
    <div className="page">
      <div className="result-container">
        <div role="status" aria-live="polite">
          {!done && <div className="spinner" aria-hidden="true" />}
          <h2>{title}</h2><p>{message}</p>
        </div>
        {orderId && <p>Pedido #{orderId}{total != null ? ` · Total: ${money(total)}` : ''}</p>}
        {error && <p role="alert" className="auth-message error">{error}</p>}
        <div className="result-actions">
          {done && <button type="button" className="btn-secondary" onClick={cancel}>Volver al carrito</button>}
          {canPayAgain && (
            <button className="btn-primary" onClick={payAgain}>
              Abrir Mercado Pago
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
