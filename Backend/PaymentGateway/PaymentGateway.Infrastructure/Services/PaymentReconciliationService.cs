using System.Globalization;
using MercadoPago.Error;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.Infrastructure.Services;

public sealed class PaymentReconciliationService(IOrderRepository orders, IPaymentService payments,
    PaymentDbContext db, ILogger<PaymentReconciliationService> logger) : IPaymentReconciliationService
{
    public async Task<PaymentReconciliationResult> ReconcileAsync(long? paymentId, Order? expectedOrder = null)
    {
        // Verificacion segura contra servidores MP
        VerifiedPayment payment;
        try
        {
            if (paymentId is null && expectedOrder is not null)
                paymentId = await payments.FindPaymentIdForOrderAsync(expectedOrder);
            if (paymentId is null) return PaymentReconciliationResult.Success; // La preferencia todavía no tiene pagos.
            payment = await payments.VerifyPaymentStatusAsync(paymentId.Value);
        }
        catch (Exception exception) when (exception is MercadoPagoException or MercadoPagoApiException or HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning("No se pudo consultar el pago {PaymentId} en Mercado Pago para la orden {OrderId}: HTTP {ProviderStatus}, {ErrorType}; se requiere reintento.",
                paymentId, expectedOrder?.IdOrder, (exception as MercadoPagoApiException)?.StatusCode, exception.GetType().Name);
            return PaymentReconciliationResult.Unavailable;
        }
        if (payment.Id != paymentId || string.IsNullOrWhiteSpace(payment.Status))
            return PaymentReconciliationResult.InvalidProviderResponse;
        var status = payment.Status;

        // Conversion ID orden a numero
        if (!int.TryParse(payment.ExternalReference, NumberStyles.None, CultureInfo.InvariantCulture, out int orderId) || orderId <= 0)
        {
            return expectedOrder is not null ? PaymentReconciliationResult.Mismatch : PaymentReconciliationResult.Success;
        }
        if (expectedOrder is not null && orderId != expectedOrder.IdOrder)
            return PaymentReconciliationResult.Mismatch;

        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        // Recuperacion orden en base de datos
        var order = await orders.GetOrderByIdAsync(orderId);
        if (order == null || (expectedOrder is not null && order.IdCustomer != expectedOrder.IdCustomer))
        {
            return PaymentReconciliationResult.NotFound;
        }

        if (string.IsNullOrWhiteSpace(order.MercadoPagoPreferenceId) || order.TotalAmount <= 0 ||
            payment.Amount != order.TotalAmount || !string.Equals(payment.Currency, "ARS", StringComparison.Ordinal))
        {
            logger.LogWarning("El pago {PaymentId} no coincide con el importe/moneda de la orden {OrderId} o la orden no tiene preferencia.", paymentId, orderId);
            return PaymentReconciliationResult.Mismatch;
        }

        // Preserve the provider's approval instant; never substitute order creation or webhook arrival.
        if (status == "approved" && order.ApprovedAt is null && payment.ApprovedAt is not null)
        {
            order.ApprovedAt = payment.ApprovedAt.Value.ToUniversalTime();
            await orders.UpdateOrderAsync(order);
        }

        if (order.ManuallyCancelled)
        {
            // A provider notification must not undo an administrator's cancellation.
            if (status == "approved" && order.PreviousStatus is not ("APPROVED" or "PAID_REQUIRES_REVIEW"))
            {
                order.PreviousStatus = "PAID_REQUIRES_REVIEW";
                order.ConfirmationEmailPending = true;
                await orders.UpdateOrderAsync(order);
            }
            await transaction.CommitAsync();
            return PaymentReconciliationResult.Success;
        }
        if (order.Status == "APPROVED" || order.Status == "PAID_REQUIRES_REVIEW")
        {
            await transaction.CommitAsync();
            return PaymentReconciliationResult.Success;
        }
        var reservationReleased = order.Status == "REJECTED" || order.Status == "CANCELLED";
        // Actualizacion estado segun respuesta de MP
        if (status == "approved")
        {
            var available = true;
            if (reservationReleased)
            {
                var physical = order.Items.Where(i => i.ProductType == "PHYSICAL").ToList();
                var physicalIds = physical.Select(i => i.IdProduct).ToList();
                var stock = await db.Products.Where(p => physicalIds.Contains(p.IdProduct)).ToDictionaryAsync(p => p.IdProduct);
                available = physical.All(i => stock.TryGetValue(i.IdProduct, out var product) && product.Stock >= i.Quantity);
                if (available)
                    foreach (var item in physical) stock[item.IdProduct].Stock -= item.Quantity;
            }
            order.Status = available ? "APPROVED" : "PAID_REQUIRES_REVIEW";
            order.ConfirmationEmailPending = true;
        }
        else if (status == "rejected" || status == "cancelled")
        {
            foreach (var item in order.Items.Where(i => i.ProductType == "PHYSICAL" && !reservationReleased))
            {
                var product = await db.Products.FindAsync(item.IdProduct);
                if (product is not null) product.Stock += item.Quantity;
            }
            order.Status = "REJECTED";
        }
        else if (!reservationReleased && (status == "pending" || status == "in_process" || status == "authorized"))
        {
            order.Status = "PAYMENT_PROCESSING";
        }

        // Persistencia nuevo estado
        await orders.UpdateOrderAsync(order);
        await transaction.CommitAsync();
        logger.LogInformation("Pago {PaymentId} verificado para la orden {OrderId}: {OrderStatus}.", paymentId, orderId, order.Status);

        // Confirmacion de recepcion a MP
        return PaymentReconciliationResult.Success;
    }
}
