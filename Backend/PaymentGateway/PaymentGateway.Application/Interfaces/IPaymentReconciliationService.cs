using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Application.Interfaces;

public enum PaymentReconciliationResult { Success, Unavailable, InvalidProviderResponse, NotFound, Mismatch }

public interface IPaymentReconciliationService
{
    Task<PaymentReconciliationResult> ReconcileAsync(long? paymentId, Order? expectedOrder = null);
}
