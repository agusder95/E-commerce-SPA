import { useState, useEffect } from "react";
import { getMyPurchases, getMyPendingPurchases } from "../api/api";

const MP_CHECKOUT_URL = "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=";

const STATUS_LABELS = {
  PENDING_PAYMENT: "Pendiente de pago",
  Pending: "Pendiente de pago",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
};

export default function MyPurchases() {
  const [activeTab, setActiveTab] = useState("approved");
  const [approved, setApproved] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFn = activeTab === "approved" ? getMyPurchases : getMyPendingPurchases;

    fetchFn()
      .then((data) => {
        if (activeTab === "approved") {
          setApproved(data);
        } else {
          setPending(data);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeTab]);

  function switchTab(tab) {
    setActiveTab(tab);
    setLoading(true);
    setError(null);
  }

  const purchases = activeTab === "approved" ? approved : pending;

  if (loading) return <div className="loading">Cargando compras...</div>;
  if (error) return <div className="page"><div className="auth-message error">{error}</div></div>;

  return (
    <div className="page">
      <h1 className="page-title">Mis Compras</h1>

      <div className="purchases-tabs">
        <button
          className={`purchases-tab ${activeTab === "approved" ? "active" : ""}`}
          onClick={() => switchTab("approved")}
        >
          Aprobadas
        </button>
        <button
          className={`purchases-tab ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => switchTab("pending")}
        >
          Pendientes / Canceladas
        </button>
      </div>

      {purchases.length === 0 ? (
        <div className="purchases-empty">
          <p>
            {activeTab === "approved"
              ? "Aún no tenés compras aprobadas."
              : "No tenés compras pendientes o canceladas."}
          </p>
        </div>
      ) : (
        <div className="purchases-list">
          {purchases.map((p) => (
            <div className="purchase-card" key={p.orderId}>
              <div className="purchase-header">
                <h3>Orden #{p.orderId}</h3>
                <div className="purchase-header-right">
                  <span className={`purchase-status status-${p.status?.toLowerCase()}`}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                  <span className="date">
                    {new Date(p.createdAt).toLocaleDateString("es-AR")}
                  </span>
                </div>
              </div>
              <ul className="purchase-items">
                {p.items.map((item, i) => (
                  <li key={i}>
                    <span>{item.productName}</span>
                    {activeTab === "approved" && (
                      <a href={item.downloadUrl} target="_blank" rel="noreferrer">
                        Descargar
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {activeTab === "pending" && p.status !== "CANCELLED" && p.mercadoPagoPreferenceId && (
                <div className="purchase-actions">
                  <button
                    className="btn-pay"
                    onClick={() =>
                      window.open(MP_CHECKOUT_URL + p.mercadoPagoPreferenceId, "_blank")
                    }
                  >
                    Ir a pagar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
