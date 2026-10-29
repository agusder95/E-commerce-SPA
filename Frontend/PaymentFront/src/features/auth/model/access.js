export const CUSTOMER_ROLES = Object.freeze(['customer', 'admin']);
export const ADMIN_ROLES = Object.freeze(['admin']);

export function hasRouteAccess({ isAuthenticated, role }, allowedRoles = []) {
  return Boolean(isAuthenticated && typeof role === 'string' &&
    allowedRoles.includes(role.trim().toLowerCase()));
}

export function readTokenClaims(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')), char => char.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    return claims && typeof claims === 'object' && !Array.isArray(claims) ? claims : null;
  } catch { return null; }
}

export function tokenRole(claims) {
  const role = claims?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? claims?.role;
  return typeof role === 'string' ? role : null;
}
