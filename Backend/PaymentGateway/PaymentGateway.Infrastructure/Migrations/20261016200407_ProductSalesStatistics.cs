using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PaymentGateway.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ProductSalesStatistics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "ORDERS",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "BeforeCouponUnitPrice",
                table: "ORDER_ITEMS",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PRODUCT_PRICE_HISTORY",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    IdProduct = table.Column<int>(type: "integer", nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    DiscountEndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Reason = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PRODUCT_PRICE_HISTORY", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PRODUCT_PRICE_HISTORY_PRODUCTS_IdProduct",
                        column: x => x.IdProduct,
                        principalTable: "PRODUCTS",
                        principalColumn: "Id_Product",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ORDERS_Status_ApprovedAt",
                table: "ORDERS",
                columns: new[] { "Status", "ApprovedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PRODUCT_PRICE_HISTORY_IdProduct_RecordedAt_Id",
                table: "PRODUCT_PRICE_HISTORY",
                columns: new[] { "IdProduct", "RecordedAt", "Id" });
            // Existing prices are observed now; their earlier effective dates are unknown.
            migrationBuilder.Sql("""
                INSERT INTO "PRODUCT_PRICE_HISTORY"
                    ("IdProduct", "RecordedAt", "UnitPrice", "DiscountPrice", "DiscountEndDate", "Reason")
                SELECT "Id_Product", CURRENT_TIMESTAMP, "UnitPrice", "DiscountPrice", "DiscountEndDate", 'INITIAL_SNAPSHOT'
                FROM "PRODUCTS";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PRODUCT_PRICE_HISTORY");

            migrationBuilder.DropIndex(
                name: "IX_ORDERS_Status_ApprovedAt",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "BeforeCouponUnitPrice",
                table: "ORDER_ITEMS");
        }
    }
}
