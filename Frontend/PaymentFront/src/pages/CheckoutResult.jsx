import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useCart } from "../context/useCart";
import { getOrderStatus } from "../api/api";

const MP_CHECKOUT_URL = "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=";

export default function CheckoutResult() {
  const [params] = useSearchParams();
  const orderId = params.get("orderId");
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [message, setMessage] = useState("Esperando confirmación de pago...");
  const [done, setDone] = useState(false);
  const [preferenceId, setPreferenceId] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!orderId || done) return;

    intervalRef.current = setInterval(async () => {
      try {
        const order = await getOrderStatus(orderId);
        if (order.mercadoPagoPreferenceId) {
          setPreferenceId(order.mercadoPagoPreferenceId);
        }
        if (order.status === "APPROVED") {
          clearInterval(intervalRef.current);
          clearCart();
          setMessage("¡Pago aprobado! Redirigiendo a tus compras...");
          setDone(true);
          setTimeout(() => navigate("/my-purchases"), 2000);
        } else if (order.status === "REJECTED") {
          clearInterval(intervalRef.current);
          setMessage("El pago fue rechazado. Podés volver a intentar.");
          setDone(true);
        } else if (order.status === "CANCELLED") {
          clearInterval(intervalRef.current);
          setMessage("La orden fue cancelada.");
          setDone(true);
        }
      } catch {
        // orden todavia no existe en DB, seguir esperando
      }
    }, 3000);

    return () => clearInterval(intervalRef.current);
  }, [orderId, done, clearCart, navigate]);

  function handleCancel() {
    clearInterval(intervalRef.current);
    navigate("/cart");
  }

  function handlePayAgain() {
    if (preferenceId) {
      window.open(MP_CHECKOUT_URL + preferenceId, "_blank");
    }
  }

  return (
    <div className="page">
      <div className="result-container">
        {!done && <div className="spinner" />}
        <h2>Procesando pago</h2>
        <p>{message}</p>
        <div className="result-actions">
          {!done && (
            <button className="btn-secondary" onClick={handleCancel}>
              Cancelar y volver al carrito
            </button>
          )}
          {done && preferenceId && (
            <button className="btn-primary" onClick={handlePayAgain}>
              Volver al pago
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
