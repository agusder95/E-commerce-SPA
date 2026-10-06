using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using PaymentGateway.Domain.Entities;

namespace PaymentGateway.Infrastructure.Persistence;

public partial class PaymentDbContext : DbContext
{
    public PaymentDbContext() { }

    public PaymentDbContext(DbContextOptions<PaymentDbContext> options)
        : base(options) { }

    public virtual DbSet<Customer> Customers { get; set; }

    public virtual DbSet<Order> Orders { get; set; }

    public virtual DbSet<OrderItem> OrderItems { get; set; }

    public virtual DbSet<Product> Products { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasKey(e => e.IdCustomer).HasName("PK__CUSTOMER__027A27688B2B4CD7");

            entity.ToTable("CUSTOMERS");

            entity.HasIndex(e => e.Email, "UQ__CUSTOMER__A9D10534B6608E56").IsUnique();

            entity.Property(e => e.IdCustomer).HasColumnName("Id_customer");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(e => e.Email).HasMaxLength(255).IsUnicode(false);
            entity
                .Property(e => e.Role)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Customer");
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(e => e.IdOrder).HasName("PK__ORDERS__33F95B5C7FCD8AD5");

            entity.ToTable("ORDERS");

            entity.Property(e => e.IdOrder).HasColumnName("Id_order");
            entity.Property(e => e.DatePurchase).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(e => e.IdCustomer).HasColumnName("Id_customer");
            entity.Property(e => e.MercadoPagoPreferenceId).HasMaxLength(255).IsUnicode(false);
            entity
                .Property(e => e.Status)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasDefaultValue("Pending");
            entity.Property(e => e.SubTotal).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.CouponCodeUsed).HasMaxLength(50);
            entity.Property(e => e.GlobalDiscount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TotalAmount).HasColumnType("decimal(18, 2)");

            entity
                .HasOne(d => d.Customer)
                .WithMany(p => p.Orders)
                .HasForeignKey(d => d.IdCustomer)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Orders_Customers");
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.HasKey(e => e.IdOrderItem).HasName("PK__ORDER_IT__3857F80AC8D7CCEF");

            entity.ToTable("ORDER_ITEMS");

            entity.Property(e => e.IdOrderItem).HasColumnName("Id_order_item");
            entity.Property(e => e.IdOrder).HasColumnName("Id_order");
            entity.Property(e => e.IdProduct).HasColumnName("Id_Product").HasDefaultValue(1);
            entity.Property(e => e.ProductName).HasMaxLength(255).IsUnicode(false);
            entity.Property(e => e.OriginalUnitPrice).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.DiscountApplied).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.FinalPrice).HasColumnType("decimal(18, 2)");

            entity
                .HasOne(d => d.Order)
                .WithMany(p => p.Items)
                .HasForeignKey(d => d.IdOrder)
                .HasConstraintName("FK_OrderItems_Orders");

            entity
                .HasOne(d => d.Product)
                .WithMany(p => p.OrderItems)
                .HasForeignKey(d => d.IdProduct)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_OrderItems_Products");
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.IdProduct).HasName("PK__PRODUCTS__5BD4DEE4F7C1E5A0");

            entity.ToTable("PRODUCTS");

            entity.Property(e => e.IdProduct).HasColumnName("Id_Product");
            entity.Property(e => e.ProductName).HasMaxLength(150);
            entity.Property(e => e.UnitPrice).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Type).HasMaxLength(50);
            entity.Property(e => e.Thumbnail).HasMaxLength(255);
            entity.Property(e => e.DiscountPrice).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(e => e.IsDeleted).HasDefaultValue(false);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
