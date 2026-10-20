using System.Globalization;
using MercadoPago.Error;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.Infrastructure.Services;

public sealed class PaymentReconciliationService(IOrderRepository orders, IPaymentService payments,
    PaymentDbContext db, ILogger<PaymentReconciliationService> logger,
    IOptions<PaymentTrackingOptions>? tracking = null) : IPaymentReconciliationService
{
    private readonly PaymentTrackingOptions _tracking = tracking?.Value ?? new PaymentTrackingOptions();

    public async Task<PaymentReconciliationResult> ReconcileAsync(long? paymentId, Order? expectedOrder = null)
    {
        // Webhook IDs are authenticated by the controller. Verify before trusting their order reference.
        VerifiedPayment? verified = null;
        if (expectedOrder is null)
        {
            if (paymentId is null) return PaymentReconciliationResult.Success;
            try { verified = await payments.VerifyPaymentStatusAsync(paymentId.Value); }
            catch (Exception exception) when (IsProviderFailure(exception))
            {
                logger.LogWarning(exception, "No se pudo verificar el webhook del pago {PaymentId}.", paymentId);
                return PaymentReconciliationResult.Unavailable;
            }
            if (verified.Id != paymentId || string.IsNullOrWhiteSpace(verified.Status))
                return PaymentReconciliationResult.InvalidProviderResponse;
            if (!int.TryParse(verified.ExternalReference, NumberStyles.None, CultureInfo.InvariantCulture, out var id) || id <= 0)
                return PaymentReconciliationResult.Success;
            expectedOrder = await db.Orders.AsNoTracking().SingleOrDefaultAsync(o => o.IdOrder == id);
            if (expectedOrder is null) return PaymentReconciliationResult.NotFound;
        }

        await using var orderLock = await PaymentOrderLock.TryAcquireAsync(db, expectedOrder.IdOrder);
        // A webhook must be retried if another instance is updating this order.
        if (orderLock is null) return verified is null ? PaymentReconciliationResult.Success : PaymentReconciliationResult.Unavailable;
        var current = await db.Orders.AsNoTracking().SingleOrDefaultAsync(o => o.IdOrder == expectedOrder.IdOrder);
        if (current is null || current.IdCustomer != expectedOrder.IdCustomer) return PaymentReconciliationResult.NotFound;
        var now = DateTime.UtcNow;
        if (verified is null && (!PaymentTrackingOptions.IsUnresolved(current) ||
            string.IsNullOrWhiteSpace(current.MercadoPagoPreferenceId) ||
            (!PaymentTrackingOptions.IsAwaitingPayment(current) && _tracking.TrackingDeadline(current) <= now) ||
            current.NextPaymentCheckAt > now || (current.NextPaymentCheckAt is null && current.LastPaymentCheckAt is not null)))
            return PaymentReconciliationResult.Success;

        var attempts = current.PaymentCheckAttempts + 1;
        // Persist a future attempt before the network request, including if the process crashes.
        await db.Orders.Where(o => o.IdOrder == current.IdOrder).ExecuteUpdateAsync(update => update
            .SetProperty(o => o.LastPaymentCheckAt, now)
            .SetProperty(o => o.PaymentCheckAttempts, attempts)
            .SetProperty(o => o.NextPaymentCheckAt, now.Add(_tracking.Delay(attempts))));

        var result = PaymentReconciliationResult.Unavailable;
        try
        {
            // Only reuse IDs while their payment remains in progress; rejected payments may be retried.
            var knownId = paymentId ?? (current.Status == "PAYMENT_PROCESSING" ? current.PaymentId : null);
            result = await ReconcileCoreAsync(knownId, current, verified);
            // Only expire an unpaid reservation after a successful provider check.
            if (result == PaymentReconciliationResult.Success && current.ExpiresAt <= DateTime.UtcNow)
                await orders.CancelOrdersAsync([current]);
            return result;
        }
        catch (Exception exception) when (exception.GetBaseException() is PostgresException
            { SqlState: PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.DeadlockDetected })
        {
            logger.LogWarning(exception, "Se reintentará la conciliación de la orden {OrderId} por concurrencia.", current.IdOrder);
            result = PaymentReconciliationResult.Unavailable;
            return result;
        }
        finally
        {
            var latest = await db.Orders.AsNoTracking().SingleAsync(o => o.IdOrder == current.IdOrder);
            var completedAt = DateTime.UtcNow;
            DateTime? next = PaymentTrackingOptions.IsUnresolved(latest) &&
                (PaymentTrackingOptions.IsAwaitingPayment(latest) || _tracking.TrackingDeadline(latest) > completedAt) &&
                !(latest.ManuallyCancelled && latest.PreviousStatus is "APPROVED" or "PAID_REQUIRES_REVIEW")
                ? completedAt.Add(_tracking.Delay(attempts, result != PaymentReconciliationResult.Success)) : null;
            if (!PaymentTrackingOptions.IsAwaitingPayment(latest) && next > _tracking.TrackingDeadline(latest)) next = _tracking.TrackingDeadline(latest);
            // Ensure the final unpaid check is due at the reservation deadline, not five minutes later.
            if (next is not null && PaymentTrackingOptions.IsAwaitingPayment(latest) && latest.ExpiresAt > completedAt && next > latest.ExpiresAt)
                next = latest.ExpiresAt;
            await db.Orders.Where(o => o.IdOrder == current.IdOrder).ExecuteUpdateAsync(update => update
                .SetProperty(o => o.NextPaymentCheckAt, next));
            logger.LogInformation("Conciliación orden {OrderId}: {Result}; intento {Attempt}; próxima consulta {NextCheck}.",
                current.IdOrder, result, attempts, next);
        }
    }

    private static bool IsProviderFailure(Exception exception) =>
        exception is MercadoPagoException or MercadoPagoApiException or HttpRequestException or TaskCanceledException;

    private async Task<PaymentReconciliationResult> ReconcileCoreAsync(long? paymentId, Order expectedOrder, VerifiedPayment? verified)
    {
        // Verificacion segura contra servidores MP
        VerifiedPayment payment;
        try
        {
            if (paymentId is null && expectedOrder is not null)
                paymentId = await payments.FindPaymentIdForOrderAsync(expectedOrder);
            if (paymentId is null) return PaymentReconciliationResult.Success; // La preferencia todavía no tiene pagos.
            payment = verified ?? await payments.VerifyPaymentStatusAsync(paymentId.Value);
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
        await db.Entry(order).ReloadAsync();

        if (string.IsNullOrWhiteSpace(order.MercadoPagoPreferenceId) || order.TotalAmount <= 0 ||
            payment.Amount != order.TotalAmount || !string.Equals(payment.Currency, "ARS", StringComparison.Ordinal))
        {
            logger.LogWarning("El pago {PaymentId} no coincide con el importe/moneda de la orden {OrderId} o la orden no tiene preferencia.", paymentId, orderId);
            return PaymentReconciliationResult.Mismatch;
        }
        order.PaymentId = payment.Id;

        // Preserve the provider's approval instant; never substitute order creation or webhook arrival.
        if (status == "approved" && order.ApprovedAt is null && payment.ApprovedAt is not null)
        {
            order.ApprovedAt = payment.ApprovedAt.Value.ToUniversalTime();
        }

        if (order.ManuallyCancelled)
        {
            // A provider notification must not undo an administrator's cancellation.
            if (status == "approved" && order.PreviousStatus is not ("APPROVED" or "PAID_REQUIRES_REVIEW"))
            {
                order.PreviousStatus = "PAID_REQUIRES_REVIEW";
                order.ConfirmationEmailPending = true;
            }
            await orders.UpdateOrderAsync(order);
            await transaction.CommitAsync();
            return PaymentReconciliationResult.Success;
        }
        if (order.Status == "APPROVED" || order.Status == "PAID_REQUIRES_REVIEW")
        {
            await orders.UpdateOrderAsync(order);
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
