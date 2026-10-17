export function apiErrorMessage(body, status) {
  const errors = [...new Set(Object.values(body?.errors || {}).flat().filter(value => typeof value === 'string' && value))];
  return body?.message || body?.Message || errors.join(' ') || body?.title || `Error ${status}`;
}
