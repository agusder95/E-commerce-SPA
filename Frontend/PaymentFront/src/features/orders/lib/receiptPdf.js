import { jsPDF } from 'jspdf';
import { purchaseReceipt } from '../model/receipt.js';
import { money } from '../../../shared/utils/format.js';

export function createReceiptPdf(purchase) {
  const receipt = purchaseReceipt(purchase);
  const first = renderReceipt(receipt, 297);
  return first.doc.getNumberOfPages() === 1
    ? renderReceipt(receipt, Math.min(297, Math.max(100, Math.ceil(first.contentEnd + 18)))).doc
    : first.doc;
}

function renderReceipt(receipt, height) {
  const doc = new jsPDF({ unit: 'mm', format: [80, height], orientation: 'portrait' });
  doc.setProperties({ title: `Ticket de compra ${receipt.orderId}`, subject: 'Comprobante de compra', creator: 'forma.' });
  const margin = 7;
  const width = 66;
  let y = 12;
  const price = value => money(value, 2).replaceAll('\u00a0', ' ');
  function ensureSpace(height = 5) {
    if (y + height <= doc.internal.pageSize.getHeight() - 15) return;
    doc.addPage([80, doc.internal.pageSize.getHeight()], 'portrait'); y = 12;
    doc.setFont('courier', 'normal'); doc.setFontSize(8);
    doc.text(`Compra #${receipt.orderId} (continuación)`, margin, y); y += 9;
  }
  function text(value, { bold = false, size = 8, center = false } = {}) {
    doc.setFont('courier', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    // Receipt text uses Latin characters supported by the built-in PDF font.
    const lines = doc.splitTextToSize(String(value).replaceAll('\u00a0', ' '), width);
    for (const line of lines) {
      ensureSpace(size * 0.45);
      doc.setFont('courier', bold ? 'bold' : 'normal'); doc.setFontSize(size);
      doc.text(line, center ? 40 : margin, y, center ? { align: 'center' } : undefined);
      y += size * 0.45;
    }
  }
  function rule() {
    ensureSpace(6); y += 2;
    doc.setDrawColor(120); doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, margin + width, y); doc.setLineDashPattern([], 0); y += 5;
  }
  text('forma.', { bold: true, size: 18, center: true });
  text('COMPROBANTE DE COMPRA', { bold: true, center: true });
  text(`Compra #${receipt.orderId}`, { center: true });
  text(receipt.date, { center: true }); text(receipt.status, { center: true }); rule();
  for (const item of receipt.items) {
    ensureSpace(22);
    text(item.name, { bold: true }); text(item.type);
    text(`${item.quantity} x ${price(item.unitPrice)} = ${price(item.total)}`);
    if (item.discount > 0) {
      text(`Precio original: ${price(item.originalUnitPrice)} c/u`);
      text(`Ahorro: ${price(item.discount)}`);
    }
    y += 4;
  }
  rule(); text(`Subtotal: ${price(receipt.subtotal)}`);
  text(`Descuentos: -${price(receipt.discount)}`);
  text(`Cupón: ${receipt.coupon || 'Sin cupón'}`);
  rule(); text(`TOTAL: ${price(receipt.total)}`, { bold: true, size: 11 }); rule();
  text(`${receipt.quantity} ${receipt.quantity === 1 ? 'unidad' : 'unidades'}`, { center: true });
  text('Importes en pesos argentinos (ARS).', { center: true });
  text('Conservá este comprobante.', { center: true });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFont('courier', 'normal'); doc.setFontSize(7);
    doc.text(`Página ${page} de ${pages}`, 40, doc.internal.pageSize.getHeight() - 7, { align: 'center' });
  }
  return { doc, contentEnd: y };
}

export const downloadReceiptPdf = purchase => createReceiptPdf(purchase).save(`ticket-compra-${purchase.orderId}.pdf`);
