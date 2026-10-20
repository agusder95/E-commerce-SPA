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

    public virtual DbSet<Coupon> Coupons { get; set; }
    public virtual DbSet<DailyProductSale> DailyProductSales { get; set; }
    public virtual DbSet<DailySale> DailySales { get; set; }
    public virtual DbSet<Tag> Tags { get; set; }

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
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasDefaultValue("CUSTOMER");
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
            entity.Property(e => e.SubTotal).HasColumnType("decimal(18, 2)").HasDefaultValue(0m);
            entity.Property(e => e.CouponCodeUsed).HasMaxLength(50);
            entity.Property(e => e.GlobalDiscount).HasColumnType("decimal(18, 2)").HasDefaultValue(0m);
            entity.Property(e => e.TotalAmount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.ManuallyCancelled).HasDefaultValue(false);
            entity.Property(e => e.PreviousStatus).HasMaxLength(50);
            entity.Property(e => e.ShippingAddress).HasMaxLength(2000);
            entity.Property(e => e.PaymentCheckAttempts).HasDefaultValue(0);
            entity.HasIndex(e => e.NextPaymentCheckAt).HasFilter("\"NextPaymentCheckAt\" IS NOT NULL");
            entity.HasIndex(e => e.ExpiresAt).HasFilter("\"Status\" IN ('Pending', 'PENDING_PAYMENT')");

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
            entity.Property(e => e.OriginalUnitPrice).HasColumnType("decimal(18, 2)").HasDefaultValue(0m);
            entity.Property(e => e.DiscountApplied).HasColumnType("decimal(18, 2)").HasDefaultValue(0m);
            entity.Property(e => e.FinalPrice).HasColumnType("decimal(18, 2)").HasDefaultValue(0m);
            entity.Property(e => e.ProductDiscount).HasPrecision(18, 2).HasDefaultValue(0m);
            entity.Property(e => e.ProductType).HasMaxLength(50);
            entity.Property(e => e.DigitalFileKey).HasMaxLength(500);

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
            entity.Property(e => e.Stock).HasDefaultValue(0);
            entity.Property(e => e.Type).HasMaxLength(50);
            entity.Property(e => e.Thumbnail).HasMaxLength(255);
            entity.Property(e => e.DiscountPrice).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(e => e.IsDeleted).HasDefaultValue(false);
            entity.Property(e => e.DigitalFileKey).HasMaxLength(500);
        });

        modelBuilder.Entity<Coupon>(entity =>
        {
            entity.ToTable("COUPONS");
            entity.HasKey(e => e.IdCoupon).HasName("PK_COUPONS");
            entity.Property(e => e.IdCoupon).HasColumnName("Id_coupon");
            entity.Property(e => e.Code).HasMaxLength(50);
            entity.HasIndex(e => e.Code).IsUnique().HasDatabaseName("UQ_COUPONS_Code");
            entity.Property(e => e.Discount).HasPrecision(5, 2).HasDefaultValue(0m);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.Cumulative).HasDefaultValue(false);
            entity.Property(e => e.Used).HasDefaultValue(0);
            entity.Property(e => e.ProductType).HasMaxLength(20);
        });

        modelBuilder.Entity<DailyProductSale>(entity =>
        {
            entity.ToTable("DAILY_PRODUCT_SALES");
            entity.HasKey(e => e.IdDailyProductSale).HasName("PK__DAILY_PR__4A3B2C1D5E6F7A8B");
            entity.Property(e => e.IdDailyProductSale).HasColumnName("Id_daily_product_sale");
            entity.Property(e => e.SaleDate).HasColumnType("date");
            entity.Property(e => e.IdProduct).HasColumnName("Id_Product");
            entity.Property(e => e.ProductName).HasMaxLength(255);
            entity.Property(e => e.GrossAmount).HasPrecision(18, 2);
            entity.Property(e => e.NetAmount).HasPrecision(18, 2);
            entity.Property(e => e.DiscountAmount).HasPrecision(18, 2);
            entity.HasIndex(e => new { e.SaleDate, e.IdProduct })
                .IsUnique().HasDatabaseName("UQ__DAILY_PR__SALE_PRODUCT");
            entity.HasIndex(e => e.IdProduct).HasDatabaseName("IX_DAILY_PRODUCT_SALES_Id_Product");
            entity.HasOne(e => e.Product).WithMany().HasForeignKey(e => e.IdProduct)
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_DailyProductSales_Products");
        });

        modelBuilder.Entity<DailySale>(entity =>
        {
            entity.ToTable("DAILY_SALES");
            entity.HasKey(e => e.IdDailySale).HasName("PK__DAILY_SA__F0D5A0E9D9C3B2A1");
            entity.Property(e => e.IdDailySale).HasColumnName("Id_daily_sale");
            entity.Property(e => e.SaleDate).HasColumnType("date");
            entity.Property(e => e.GrossAmount).HasPrecision(18, 2);
            entity.Property(e => e.NetAmount).HasPrecision(18, 2);
            entity.Property(e => e.DiscountAmount).HasPrecision(18, 2);
            entity.HasIndex(e => e.SaleDate).IsUnique().HasDatabaseName("UQ__DAILY_SA__SALE_DATE");
        });

        modelBuilder.Entity<Tag>(entity =>
        {
            entity.ToTable("TAGS");
            entity.HasKey(e => e.IdTag).HasName("PK__TAGS__7D2F0A1B3C4D5E6F");
            entity.Property(e => e.IdTag).HasColumnName("Id_Tag");
            entity.Property(e => e.Name).HasMaxLength(50);
            entity.Property(e => e.NormalizedName).HasComputedColumnSql(
                """upper(regexp_replace(normalize(regexp_replace(btrim("Name"), '\s+', ' ', 'g'), NFD), '[\u0300-\u036f]', '', 'g'))""", stored: true);
            entity.HasIndex(e => e.NormalizedName).IsUnique().HasDatabaseName("UQ_TAGS_NormalizedName");
            entity.HasIndex(e => e.Name).IsUnique().HasDatabaseName("UQ__TAGS__NAME");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
