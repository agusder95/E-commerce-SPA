const API_BASE = "http://localhost:5076";

function getToken() {
  return localStorage.getItem("token");
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.Detailed || body?.Message || `Error ${res.status}`);
  }
  return res.json();
}

export function requestAccess(email) {
  return apiFetch("/api/auth/request-access", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function verifyAccess(email, pin) {
  return apiFetch("/api/auth/verify-access", {
    method: "POST",
    body: JSON.stringify({ email, pin }),
  });
}

export function createOrder(orderData) {
  return apiFetch("/api/checkout/create-order", {
    method: "POST",
    body: JSON.stringify(orderData),
  });
}

export function getMyPurchases() {
  return apiFetch("/api/orders/my-purchases");
}

export function getMyPendingPurchases() {
  return apiFetch("/api/orders/my-purchases-pending");
}

export function getOrderStatus(orderId) {
  return apiFetch(`/api/Order/${orderId}`);
}
