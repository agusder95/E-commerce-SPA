const DAY = 86400000;
export const STORE_TIME_ZONE = 'America/Argentina/Cordoba';
export const integer = value => new Intl.NumberFormat('es-AR').format(value);
export const axisMoney = value => {
  const format = number => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(number);
  return value >= 1000000 ? `$${format(value / 1000000)} mill.` : value >= 1000 ? `$${format(value / 1000)} mil` : `$${format(value)}`;
};
const utcDate = value => new Date(`${value}T00:00:00Z`);
export const addDays = (value, days) => new Date(utcDate(value).getTime() + days * DAY).toISOString().slice(0, 10);

export function storeToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: STORE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function presetRange(preset, today = storeToday()) {
  const from = preset === 'year' ? `${today.slice(0, 4)}-01-01` : addDays(today, 1 - Number(preset));
  const days = (utcDate(today) - utcDate(from)) / DAY + 1;
  return { from, to: today, groupBy: days > 180 ? 'month' : days > 45 ? 'week' : 'day' };
}

export function statisticsError(filters, today = storeToday()) {
  if (!filters.productId) return 'Elegí un producto para consultar sus estadísticas.';
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(utcDate(value).getTime()) &&
    utcDate(value).toISOString().slice(0, 10) === value;
  if (!validDate(filters.from) || !validDate(filters.to)) return 'Completá las dos fechas con días válidos.';
  if (filters.from > filters.to) return 'La fecha Desde debe ser anterior o igual a Hasta.';
  if (filters.to > today) return 'Elegí un período que termine hoy o antes.';
  if ((utcDate(filters.to) - utcDate(filters.from)) / DAY > 3660) return 'Elegí un período de hasta 10 años.';
  return '';
}

export const displayDate = (value, short = false) => new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: short ? 'short' : 'long', ...(short ? {} : { year: 'numeric' }), timeZone: 'UTC',
}).format(utcDate(value));

export const displayInstant = value => new Intl.DateTimeFormat('es-AR', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: STORE_TIME_ZONE,
}).format(new Date(value));

export function periodBounds(periodStart, query) {
  let end = periodStart;
  if (query.groupBy === 'week') end = addDays(periodStart, 6);
  if (query.groupBy === 'month') {
    const date = utcDate(periodStart);
    date.setUTCMonth(date.getUTCMonth() + 1);
    end = addDays(date.toISOString().slice(0, 10), -1);
  }
  return { from: periodStart < query.from ? query.from : periodStart, to: end > query.to ? query.to : end };
}

export function periodLabel(periodStart, query, short = false) {
  const { from, to } = periodBounds(periodStart, query);
  return from === to ? displayDate(from, short) : `${displayDate(from, true)} – ${displayDate(to, short)}`;
}

// The axes always start at zero; a price change is a step at its actual timestamp.
export function priceGeometry(periods, query, width = 720, height = 220, sharedCeiling) {
  const start = Date.parse(`${query.from}T03:00:00Z`);
  const end = Date.parse(`${addDays(query.to, 1)}T03:00:00Z`);
  const max = Math.max(1, ...periods.map(p => p.listPrice), ...periods.map(p => p.effectivePrice));
  const ceiling = sharedCeiling ?? chartCeiling(max);
  const x = value => 75 + (Date.parse(value) - start) / (end - start) * (width - 95);
  const y = value => height - 30 - value / ceiling * (height - 50);
  const path = key => periods.map((p, i) => {
    const contiguous = i > 0 && periods[i - 1].to === p.from;
    return `${contiguous ? 'L' : 'M'}${x(p.from)},${y(p[key])} L${x(p.to)},${y(p[key])}`;
  }).join(' ');
  return { x, y, ceiling, listPath: path('listPrice'), effectivePath: path('effectivePrice') };
}

export function chartCeiling(maximum) {
  if (maximum <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(maximum));
  return Math.ceil(maximum / power / 0.5) * power * 0.5;
}

export const productLabel = product => `${product.name} · ${product.type === 'PHYSICAL' ? 'Físico' : 'Digital'}${product.isDeleted ? ' · Eliminado' : ''}`;
