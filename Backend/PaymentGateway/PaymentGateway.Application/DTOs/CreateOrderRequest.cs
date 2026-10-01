namespace PaymentGateway.Application.DTOs;

public class CreateOrderRequest
{
    public int IdCustomer { get; set; }
    public List<CreateOrderItemRequest> Items { get; set; } = new();
}

public class CreateOrderItemRequest
{
    public int IdProduct { get; set; }
    public string ProductName { get; set; } = null!;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
}
