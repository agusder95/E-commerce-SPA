import { statisticsError } from './statistics.js';

export const PRODUCT_COLORS = ['#2563a6', '#b45309', '#8053a0'];
export function toggleComparisonProduct(selection, id) {
  const key = String(id);
  if (selection.some(product => product.id === key)) return selection.filter(product => product.id !== key);
  if (selection.length >= 3) return selection;
  return [...selection, { id: key, color: PRODUCT_COLORS.find(color => !selection.some(product => product.color === color)) }];
}
export function comparisonError(draft) {
  if (!draft.selection.length) return 'Elegí al menos un producto para consultar sus estadísticas.';
  if (draft.selection.length > 3 || new Set(draft.selection.map(product => product.id)).size !== draft.selection.length)
    return 'Podés comparar hasta 3 productos distintos.';
  return statisticsError({ ...draft, productId: draft.selection[0].id });
}
export function comparisonPeriods(series) {
  const dates = [...new Set(series.flatMap(item => item.data?.periods.map(period => period.periodStart) || []))].sort();
  const indexed = series.map(item => new Map(item.data?.periods.map(period => [period.periodStart, period]) || []));
  return dates.map(periodStart => ({ periodStart, values: series.map((item, index) => ({ product: item.product,
    period: indexed[index].get(periodStart) || null })) }));
}
export function comparisonPriceRows(series) {
  return series.flatMap(item => (item.data?.periods || []).map(period => ({ ...period, product: item.product })))
    .sort((a, b) => a.from.localeCompare(b.from) || String(a.product.id).localeCompare(String(b.product.id)));
}
