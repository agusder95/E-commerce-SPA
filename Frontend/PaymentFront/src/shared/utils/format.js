export const money = (value, decimals = 0) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: decimals, maximumFractionDigits: decimals,
}).format(value);
