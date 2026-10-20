export const normalizeTableSort = sort => ({ alphabetical: 'name-asc', newest: 'created-desc', oldest: 'created-asc' })[sort] || sort || 'name-asc';
export function nextTableSort(sort, column) {
  return normalizeTableSort(sort) === `${column}-asc` ? `${column}-desc` : `${column}-asc`;
}
export const dateSortValue = value => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
export function compareTableValues(a, b, direction) {
  // Missing values stay at the end in both directions.
  if (a == null || b == null) return a == null ? b == null ? 0 : 1 : -1;
  const difference = typeof a === 'number' || typeof a === 'boolean'
    ? Number(a) - Number(b)
    : String(a).localeCompare(String(b), 'es', { sensitivity: 'base', numeric: true });
  return difference * (direction === 'desc' ? -1 : 1);
}
