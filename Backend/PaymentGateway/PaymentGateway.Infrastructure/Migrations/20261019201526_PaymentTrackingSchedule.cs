using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PaymentGateway.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PaymentTrackingSchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiresAt",
                table: "ORDERS",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastPaymentCheckAt",
                table: "ORDERS",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "NextPaymentCheckAt",
                table: "ORDERS",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PaymentCheckAttempts",
                table: "ORDERS",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "PaymentId",
                table: "ORDERS",
                type: "bigint",
                nullable: true);

            // Existing preferences were issued with a 30-minute deadline. Preserve it.
            // New checkouts use the configured 20 minutes. Recover old unpaid reservations once,
            // but do not restart endless searches for historical rejected/cancelled orders.
            migrationBuilder.Sql("""
                UPDATE "ORDERS"
                SET "ExpiresAt" = "DatePurchase" + interval '30 minutes';
                UPDATE "ORDERS"
                SET "NextPaymentCheckAt" = CURRENT_TIMESTAMP
                WHERE "MercadoPagoPreferenceId" IS NOT NULL AND "MercadoPagoPreferenceId" <> ''
                  AND ("Status" IN ('Pending', 'PENDING_PAYMENT')
                    OR ("Status" IN ('PAYMENT_PROCESSING', 'REJECTED', 'CANCELLED')
                      AND "ExpiresAt" + interval '24 hours' > CURRENT_TIMESTAMP));
                """);

            migrationBuilder.CreateIndex(
                name: "IX_ORDERS_ExpiresAt",
                table: "ORDERS",
                column: "ExpiresAt",
                filter: "\"Status\" IN ('Pending', 'PENDING_PAYMENT')");

            migrationBuilder.CreateIndex(
                name: "IX_ORDERS_NextPaymentCheckAt",
                table: "ORDERS",
                column: "NextPaymentCheckAt",
                filter: "\"NextPaymentCheckAt\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ORDERS_ExpiresAt",
                table: "ORDERS");

            migrationBuilder.DropIndex(
                name: "IX_ORDERS_NextPaymentCheckAt",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "ExpiresAt",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "LastPaymentCheckAt",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "NextPaymentCheckAt",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "PaymentCheckAttempts",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "PaymentId",
                table: "ORDERS");
        }
    }
}
