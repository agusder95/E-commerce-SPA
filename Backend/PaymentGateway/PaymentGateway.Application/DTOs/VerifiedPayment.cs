namespace PaymentGateway.Application.DTOs;

// Sólo contiene información obtenida desde la API autenticada de Mercado Pago.
public sealed record VerifiedPayment(long? Id, string? Status, string? ExternalReference, decimal? Amount, string? Currency,
    DateTime? ApprovedAt = null);
