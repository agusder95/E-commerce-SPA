import { purchaseStatusLabel } from "./orderStatus.js";

const timeZone = 'America/Argentina/Ushuaia';
const receiptDate = new Intl.DateTimeFormat('es-AR', {
    timeZone, day: '2-digit', month: '2-digit', year: 'numeric',
});
const receiptTime = new Intl.DateTimeFormat('es-AR', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function purchaseReceipt(purchase) {
    const createdAt = new Date(purchase.createdAt);
    const hasCreatedAt = Boolean(purchase.createdAt) && Number.isFinite(createdAt.getTime());
    const items = purchase.items.map((item) => {
        const quantity = item.quantity ?? 1;
        const unitPrice = item.finalUnitPrice ?? 0;
        const originalUnitPrice = item.originalUnitPrice ?? unitPrice;
        return {
            name: item.productName,
            type: item.productType === "PHYSICAL" ? "Físico" : "Digital",
            quantity,
            unitPrice,
            originalUnitPrice,
            total: item.lineTotal ?? unitPrice * quantity,
            discount: Math.max(0, originalUnitPrice - unitPrice) * quantity,
        };
    });
    const subtotal =
        purchase.subtotal ??
        items.reduce(
            (sum, item) => sum + item.originalUnitPrice * item.quantity,
            0,
        );
    const total =
        purchase.totalAmount ??
        items.reduce((sum, item) => sum + item.total, 0);
    return {
        orderId: purchase.orderId,
        date: hasCreatedAt ? receiptDate.format(createdAt) : "Sin fecha",
        time: hasCreatedAt ? receiptTime.format(createdAt) : "Sin hora",
        status: purchaseStatusLabel(purchase.status),
        items,
        subtotal,
        total,
        discount: purchase.discountAmount ?? Math.max(0, subtotal - total),
        coupon: purchase.couponCodeUsed || null,
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    };
}
