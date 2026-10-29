using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PaymentGateway.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DurablePaymentNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FastRecoveryRemaining",
                table: "ORDERS",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "FastRecoveryRequestedAt",
                table: "ORDERS",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PAYMENT_NOTIFICATION_EVENTS",
                columns: table => new
                {
                    EventKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PaymentId = table.Column<long>(type: "bigint", nullable: false),
                    ReceivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PAYMENT_NOTIFICATION_EVENTS", x => x.EventKey);
                });

            migrationBuilder.CreateTable(
                name: "PAYMENT_NOTIFICATIONS",
                columns: table => new
                {
                    PaymentId = table.Column<long>(type: "bigint", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    ProcessedVersion = table.Column<long>(type: "bigint", nullable: false),
                    FirstReceivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastReceivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NextAttemptAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Attempts = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PAYMENT_NOTIFICATIONS", x => x.PaymentId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PAYMENT_NOTIFICATION_EVENTS_ReceivedAt",
                table: "PAYMENT_NOTIFICATION_EVENTS",
                column: "ReceivedAt");

            migrationBuilder.CreateIndex(
                name: "IX_PAYMENT_NOTIFICATIONS_NextAttemptAt",
                table: "PAYMENT_NOTIFICATIONS",
                column: "NextAttemptAt",
                filter: "\"NextAttemptAt\" IS NOT NULL");
            migrationBuilder.Sql("""
                CREATE FUNCTION paymentgateway_notify_payment_inbox() RETURNS trigger
                LANGUAGE plpgsql AS $$ BEGIN
                    PERFORM pg_notify('paymentgateway_order_work', ''); RETURN NULL;
                END; $$;
                CREATE TRIGGER payment_inbox_changed AFTER INSERT OR UPDATE OR DELETE ON "PAYMENT_NOTIFICATIONS"
                FOR EACH ROW EXECUTE FUNCTION paymentgateway_notify_payment_inbox();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER payment_inbox_changed ON \"PAYMENT_NOTIFICATIONS\"; DROP FUNCTION paymentgateway_notify_payment_inbox();");
            migrationBuilder.DropTable(
                name: "PAYMENT_NOTIFICATION_EVENTS");

            migrationBuilder.DropTable(
                name: "PAYMENT_NOTIFICATIONS");

            migrationBuilder.DropColumn(
                name: "FastRecoveryRemaining",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "FastRecoveryRequestedAt",
                table: "ORDERS");
        }
    }
}
