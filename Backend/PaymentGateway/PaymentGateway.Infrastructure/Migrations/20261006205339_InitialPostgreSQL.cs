using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PaymentGateway.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgreSQL : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CUSTOMERS",
                columns: table => new
                {
                    Id_customer = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Email = table.Column<string>(type: "character varying(255)", unicode: false, maxLength: 255, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    Role = table.Column<string>(type: "character varying(20)", unicode: false, maxLength: 20, nullable: false, defaultValue: "Customer")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__CUSTOMER__027A27688B2B4CD7", x => x.Id_customer);
                });

            migrationBuilder.CreateTable(
                name: "PRODUCTS",
                columns: table => new
                {
                    Id_Product = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProductName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Stock = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Thumbnail = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Tags = table.Column<string>(type: "text", nullable: true),
                    Gallery = table.Column<string>(type: "text", nullable: true),
                    DiscountPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    DiscountEndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__PRODUCTS__5BD4DEE4F7C1E5A0", x => x.Id_Product);
                });

            migrationBuilder.CreateTable(
                name: "ORDERS",
                columns: table => new
                {
                    Id_order = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Id_customer = table.Column<int>(type: "integer", nullable: false),
                    SubTotal = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CouponCodeUsed = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    GlobalDiscount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", unicode: false, maxLength: 50, nullable: false, defaultValue: "Pending"),
                    DatePurchase = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    MercadoPagoPreferenceId = table.Column<string>(type: "character varying(255)", unicode: false, maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__ORDERS__33F95B5C7FCD8AD5", x => x.Id_order);
                    table.ForeignKey(
                        name: "FK_Orders_Customers",
                        column: x => x.Id_customer,
                        principalTable: "CUSTOMERS",
                        principalColumn: "Id_customer");
                });

            migrationBuilder.CreateTable(
                name: "ORDER_ITEMS",
                columns: table => new
                {
                    Id_order_item = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Id_order = table.Column<int>(type: "integer", nullable: false),
                    Id_Product = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    ProductName = table.Column<string>(type: "character varying(255)", unicode: false, maxLength: 255, nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    OriginalUnitPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    DiscountApplied = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    FinalPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__ORDER_IT__3857F80AC8D7CCEF", x => x.Id_order_item);
                    table.ForeignKey(
                        name: "FK_OrderItems_Orders",
                        column: x => x.Id_order,
                        principalTable: "ORDERS",
                        principalColumn: "Id_order",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrderItems_Products",
                        column: x => x.Id_Product,
                        principalTable: "PRODUCTS",
                        principalColumn: "Id_Product");
                });

            migrationBuilder.CreateIndex(
                name: "UQ__CUSTOMER__A9D10534B6608E56",
                table: "CUSTOMERS",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ORDER_ITEMS_Id_order",
                table: "ORDER_ITEMS",
                column: "Id_order");

            migrationBuilder.CreateIndex(
                name: "IX_ORDER_ITEMS_Id_Product",
                table: "ORDER_ITEMS",
                column: "Id_Product");

            migrationBuilder.CreateIndex(
                name: "IX_ORDERS_Id_customer",
                table: "ORDERS",
                column: "Id_customer");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ORDER_ITEMS");

            migrationBuilder.DropTable(
                name: "ORDERS");

            migrationBuilder.DropTable(
                name: "PRODUCTS");

            migrationBuilder.DropTable(
                name: "CUSTOMERS");
        }
    }
}
