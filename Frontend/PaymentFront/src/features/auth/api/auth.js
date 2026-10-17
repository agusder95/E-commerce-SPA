import { apiFetch } from '../../../shared/api/client';

export function requestAccess(email, previousEmail = null) {
  return apiFetch("/api/auth/request-access", {
    method: "POST",
    body: JSON.stringify({ email, previousEmail }),
  });
}

export function verifyAccess(email, pin) {
  return apiFetch("/api/auth/verify-access", {
    method: "POST",
    body: JSON.stringify({ email, pin }),
  });
}
