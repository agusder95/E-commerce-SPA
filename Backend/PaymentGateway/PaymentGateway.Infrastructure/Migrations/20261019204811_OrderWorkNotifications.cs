using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PaymentGateway.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OrderWorkNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE FUNCTION paymentgateway_notify_order_work() RETURNS trigger
                LANGUAGE plpgsql AS $$
                BEGIN
                    IF TG_OP = 'UPDATE' THEN
                        IF ROW(NEW."Status", NEW."NextPaymentCheckAt", NEW."ExpiresAt",
                               NEW."MercadoPagoPreferenceId", NEW."ConfirmationEmailPending")
                           IS NOT DISTINCT FROM
                           ROW(OLD."Status", OLD."NextPaymentCheckAt", OLD."ExpiresAt",
                               OLD."MercadoPagoPreferenceId", OLD."ConfirmationEmailPending") THEN
                            RETURN NULL;
                        END IF;
                    END IF;
                    PERFORM pg_notify('paymentgateway_order_work', '');
                    RETURN NULL;
                END;
                $$;
                CREATE TRIGGER order_work_changed AFTER INSERT OR UPDATE OR DELETE ON "ORDERS"
                FOR EACH ROW EXECUTE FUNCTION paymentgateway_notify_order_work();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER order_work_changed ON "ORDERS";
                DROP FUNCTION paymentgateway_notify_order_work();
                """);
        }
    }
}
