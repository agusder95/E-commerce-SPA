using Microsoft.EntityFrameworkCore;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Infrastructure.Persistence;

public partial class PaymentDbContext
{
    public DbSet<ProductPriceHistory> ProductPriceHistory { get; set; }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        CapturePriceChanges();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        CapturePriceChanges();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void CapturePriceChanges()
    {
        ChangeTracker.DetectChanges();
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<Product>().ToList())
        {
            var added = entry.State == EntityState.Added;
            if (!added && !(entry.State == EntityState.Modified &&
                (new[] { nameof(Product.UnitPrice), nameof(Product.DiscountPrice), nameof(Product.DiscountEndDate) }
                    .Any(name => entry.Property(name).IsModified &&
                        !Equals(entry.Property(name).OriginalValue, entry.Property(name).CurrentValue))))) continue;
            // A failed SaveChanges can be retried with the same context.
            var pending = ChangeTracker.Entries<ProductPriceHistory>().FirstOrDefault(h =>
                h.State == EntityState.Added && ReferenceEquals(h.Entity.Product, entry.Entity))?.Entity;
            var history = pending ?? new ProductPriceHistory { Product = entry.Entity, RecordedAt = now,
                Reason = added ? "PRODUCT_CREATED" : "PRICE_CHANGE" };
            history.UnitPrice = entry.Entity.UnitPrice;
            history.DiscountPrice = entry.Entity.DiscountPrice;
            history.DiscountEndDate = entry.Entity.DiscountEndDate;
            if (pending is null) ProductPriceHistory.Add(history);
        }
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Order>().HasIndex(o => new { o.Status, o.ApprovedAt });
        modelBuilder.Entity<OrderItem>().Property(i => i.BeforeCouponUnitPrice).HasPrecision(18, 2);
        modelBuilder.Entity<ProductPriceHistory>(entity =>
        {
            entity.ToTable("PRODUCT_PRICE_HISTORY");
            entity.HasKey(h => h.Id);
            entity.Property(h => h.UnitPrice).HasPrecision(18, 2);
            entity.Property(h => h.DiscountPrice).HasPrecision(18, 2);
            entity.Property(h => h.Reason).HasMaxLength(30);
            entity.HasIndex(h => new { h.IdProduct, h.RecordedAt, h.Id });
            entity.HasOne(h => h.Product).WithMany().HasForeignKey(h => h.IdProduct).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
