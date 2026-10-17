namespace PaymentGateway.Domain.Entities;

public class Tag
{
    public int IdTag { get; set; }
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;
}
