using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PaymentGateway.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CompleteOriginalSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "Stock",
                table: "PRODUCTS",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "PRODUCTS",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DigitalFileKey",
                table: "PRODUCTS",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "SubTotal",
                table: "ORDERS",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)");

            migrationBuilder.AlterColumn<decimal>(
                name: "GlobalDiscount",
                table: "ORDERS",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)");

            migrationBuilder.AddColumn<bool>(
                name: "ManuallyCancelled",
                table: "ORDERS",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PreviousStatus",
                table: "ORDERS",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "OriginalUnitPrice",
                table: "ORDER_ITEMS",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)");

            migrationBuilder.AlterColumn<decimal>(
                name: "FinalPrice",
                table: "ORDER_ITEMS",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)");

            migrationBuilder.AlterColumn<decimal>(
                name: "DiscountApplied",
                table: "ORDER_ITEMS",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)");

            migrationBuilder.AddColumn<decimal>(
                name: "ProductDiscount",
                table: "ORDER_ITEMS",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "CUSTOMERS",
                type: "character varying(50)",
                unicode: false,
                maxLength: 50,
                nullable: false,
                defaultValue: "CUSTOMER",
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldUnicode: false,
                oldMaxLength: 20,
                oldDefaultValue: "Customer");

            migrationBuilder.CreateTable(
                name: "COUPONS",
                columns: table => new
                {
                    Id_coupon = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Discount = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false, defaultValue: 0m),
                    ExpirationDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    Tags = table.Column<string>(type: "text", nullable: true),
                    Cumulative = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    Used = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    ProductType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_COUPONS", x => x.Id_coupon);
                });

            migrationBuilder.CreateTable(
                name: "DAILY_PRODUCT_SALES",
                columns: table => new
                {
                    Id_daily_product_sale = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SaleDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Id_Product = table.Column<int>(type: "integer", nullable: false),
                    ProductName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    GrossAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    NetAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__DAILY_PR__4A3B2C1D5E6F7A8B", x => x.Id_daily_product_sale);
                    table.ForeignKey(
                        name: "FK_DailyProductSales_Products",
                        column: x => x.Id_Product,
                        principalTable: "PRODUCTS",
                        principalColumn: "Id_Product");
                });

            migrationBuilder.CreateTable(
                name: "DAILY_SALES",
                columns: table => new
                {
                    Id_daily_sale = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SaleDate = table.Column<DateOnly>(type: "date", nullable: false),
                    GrossAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    NetAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OrderCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__DAILY_SA__F0D5A0E9D9C3B2A1", x => x.Id_daily_sale);
                });

            migrationBuilder.CreateTable(
                name: "TAGS",
                columns: table => new
                {
                    Id_Tag = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__TAGS__7D2F0A1B3C4D5E6F", x => x.Id_Tag);
                });

            migrationBuilder.CreateIndex(
                name: "UQ_COUPONS_Code",
                table: "COUPONS",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DAILY_PRODUCT_SALES_Id_Product",
                table: "DAILY_PRODUCT_SALES",
                column: "Id_Product");

            migrationBuilder.CreateIndex(
                name: "UQ__DAILY_PR__SALE_PRODUCT",
                table: "DAILY_PRODUCT_SALES",
                columns: new[] { "SaleDate", "Id_Product" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ__DAILY_SA__SALE_DATE",
                table: "DAILY_SALES",
                column: "SaleDate",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ__TAGS__NAME",
                table: "TAGS",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "COUPONS");

            migrationBuilder.DropTable(
                name: "DAILY_PRODUCT_SALES");

            migrationBuilder.DropTable(
                name: "DAILY_SALES");

            migrationBuilder.DropTable(
                name: "TAGS");

            migrationBuilder.DropColumn(
                name: "DigitalFileKey",
                table: "PRODUCTS");

            migrationBuilder.DropColumn(
                name: "ManuallyCancelled",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "PreviousStatus",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "ProductDiscount",
                table: "ORDER_ITEMS");

            migrationBuilder.AlterColumn<int>(
                name: "Stock",
                table: "PRODUCTS",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 0);

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "PRODUCTS",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<decimal>(
                name: "SubTotal",
                table: "ORDERS",
                type: "numeric(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)",
                oldDefaultValue: 0m);

            migrationBuilder.AlterColumn<decimal>(
                name: "GlobalDiscount",
                table: "ORDERS",
                type: "numeric(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)",
                oldDefaultValue: 0m);

            migrationBuilder.AlterColumn<decimal>(
                name: "OriginalUnitPrice",
                table: "ORDER_ITEMS",
                type: "numeric(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)",
                oldDefaultValue: 0m);

            migrationBuilder.AlterColumn<decimal>(
                name: "FinalPrice",
                table: "ORDER_ITEMS",
                type: "numeric(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)",
                oldDefaultValue: 0m);

            migrationBuilder.AlterColumn<decimal>(
                name: "DiscountApplied",
                table: "ORDER_ITEMS",
                type: "numeric(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)",
                oldDefaultValue: 0m);

            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "CUSTOMERS",
                type: "character varying(20)",
                unicode: false,
                maxLength: 20,
                nullable: false,
                defaultValue: "Customer",
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldUnicode: false,
                oldMaxLength: 50,
                oldDefaultValue: "CUSTOMER");
        }
    }
}
