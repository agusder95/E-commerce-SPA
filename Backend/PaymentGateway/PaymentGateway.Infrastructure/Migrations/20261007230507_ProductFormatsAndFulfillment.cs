using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PaymentGateway.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ProductFormatsAndFulfillment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ShippingAddress",
                table: "ORDERS",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DigitalFileKey",
                table: "ORDER_ITEMS",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProductType",
                table: "ORDER_ITEMS",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "PRODUCTS"
                SET "Type" = CASE
                    WHEN LOWER("Type") IN ('digital', 'digitales') THEN 'DIGITAL'
                    WHEN LOWER("Type") IN ('physical', 'fisico', 'físico') THEN 'PHYSICAL'
                    ELSE "Type"
                END;
                UPDATE "ORDER_ITEMS" AS item
                SET "ProductType" = product."Type",
                    "DigitalFileKey" = product."DigitalFileKey"
                FROM "PRODUCTS" AS product, "ORDERS" AS orders
                WHERE item."Id_Product" = product."Id_Product"
                  AND item."Id_order" = orders."Id_order"
                  AND orders."Status" = 'APPROVED';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ShippingAddress",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "DigitalFileKey",
                table: "ORDER_ITEMS");

            migrationBuilder.DropColumn(
                name: "ProductType",
                table: "ORDER_ITEMS");
        }
    }
}
