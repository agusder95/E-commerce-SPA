import { readStoredSession } from '../auth/session.js';
import { apiErrorMessage } from './errors.js';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5076").replace(/\/$/, "");

function getToken() {
  return readStoredSession()?.token;
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...options.headers };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const error = new Error(apiErrorMessage(body, res.status));
    error.code = body?.code || body?.Code;
    error.details = body;
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) return null;
  return res.json();
}

