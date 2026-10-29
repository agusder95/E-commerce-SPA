using System;
using System.Collections.Generic;   

namespace PaymentGateway.Domain.Entities;

public partial class Customer
{
    public int IdCustomer { get; set; }

    public string Email { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string Role { get; set; } = "Customer";

    public virtual ICollection<Order> Orders { get; set; } = new List<Order>();
}
