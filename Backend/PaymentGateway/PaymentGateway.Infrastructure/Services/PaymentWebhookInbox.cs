using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.Infrastructure.Services;

public sealed class PaymentWebhookInbox(PaymentDbContext db)
{
    public async Task EnqueueAsync(long paymentId, string eventIdentity, CancellationToken cancellationToken = default)
    {
        var key = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes($"{paymentId}:{eventIdentity}")));
        var now = DateTime.UtcNow;
        // A single atomic statement: either both the receipt and durable work exist, or neither does.
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            WITH accepted AS (
                INSERT INTO "PAYMENT_NOTIFICATION_EVENTS" ("EventKey", "PaymentId", "ReceivedAt")
                VALUES ({key}, {paymentId}, {now}) ON CONFLICT ("EventKey") DO NOTHING RETURNING "PaymentId"
            )
            INSERT INTO "PAYMENT_NOTIFICATIONS" ("PaymentId", "Version", "ProcessedVersion", "FirstReceivedAt", "LastReceivedAt", "NextAttemptAt", "Attempts")
            SELECT "PaymentId", 1, 0, {now}, {now}, {now}, 0 FROM accepted
            ON CONFLICT ("PaymentId") DO UPDATE SET
                "Version" = "PAYMENT_NOTIFICATIONS"."Version" + 1,
                "FirstReceivedAt" = CASE WHEN "PAYMENT_NOTIFICATIONS"."ProcessedVersion" = "PAYMENT_NOTIFICATIONS"."Version"
                    THEN EXCLUDED."FirstReceivedAt" ELSE "PAYMENT_NOTIFICATIONS"."FirstReceivedAt" END,
                "LastReceivedAt" = EXCLUDED."LastReceivedAt",
                "NextAttemptAt" = LEAST(COALESCE("PAYMENT_NOTIFICATIONS"."NextAttemptAt", EXCLUDED."NextAttemptAt"), EXCLUDED."NextAttemptAt")
            """, cancellationToken);
    }
}
