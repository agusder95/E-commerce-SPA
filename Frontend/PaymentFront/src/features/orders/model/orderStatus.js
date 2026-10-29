export const MP_CHECKOUT_URL = 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=';

export function returnOrderId(params) {
  const id = params.get('orderId') || params.get('external_reference');
  return /^[1-9]\d*$/.test(id ?? '') && Number.isSafeInteger(Number(id)) && Number(id) <= 2147483647 ? id : null;
}

export const STATUS_LABELS = {
  APPROVED: 'Pago aprobado',
  PENDING_PAYMENT: 'Pendiente de pago', Pending: 'Pendiente de pago',
  REJECTED: 'Pago rechazado', CANCELLED: 'Compra cancelada', PAYMENT_PROCESSING: 'Pago en proceso',
  PAID_REQUIRES_REVIEW: 'Pago recibido: coordinando disponibilidad',
};

export const purchaseStatusLabel = status => STATUS_LABELS[status] || 'Estado por revisar';

export const isTerminalStatus = status => ['APPROVED', 'REJECTED', 'CANCELLED', 'PAID_REQUIRES_REVIEW'].includes(status);

export function paymentTitle(status) {
  return { APPROVED: 'Pago aprobado', REJECTED: 'Pago rechazado', CANCELLED: 'Pago cancelado',
    PAID_REQUIRES_REVIEW: 'Pago recibido', PAYMENT_PROCESSING: 'Pago en proceso' }[status] || 'Esperando tu pago';
}

export function paymentMessage(status) {
  return {
    APPROVED: '¡Pago aprobado! Redirigiendo a tus compras...',
    REJECTED: 'El pago fue rechazado. Podés volver a intentar.',
    CANCELLED: 'La orden fue cancelada.',
    PAID_REQUIRES_REVIEW: 'Recibimos el pago. La tienda se contactará para coordinar la disponibilidad del producto.',
    PAYMENT_PROCESSING: 'Mercado Pago está procesando tu pago. Esperando la confirmación de la tienda…',
  }[status] || 'Completá el pago en la pestaña de Mercado Pago. Esta pantalla se actualizará automáticamente cuando recibamos la confirmación.';
}
