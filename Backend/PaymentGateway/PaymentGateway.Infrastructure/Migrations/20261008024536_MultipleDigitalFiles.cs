using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PaymentGateway.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MultipleDigitalFiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DigitalFiles",
                table: "PRODUCTS",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DigitalFiles",
                table: "ORDER_ITEMS",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DigitalFiles",
                table: "PRODUCTS");

            migrationBuilder.DropColumn(
                name: "DigitalFiles",
                table: "ORDER_ITEMS");
        }
    }
}
