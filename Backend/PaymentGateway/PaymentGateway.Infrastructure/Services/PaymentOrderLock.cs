using Microsoft.EntityFrameworkCore;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.Infrastructure.Services;

// A session lock spans provider requests without keeping a database transaction open.
// All instances use the same namespace; locks are released on connection loss as well.
public sealed class PaymentOrderLock : IAsyncDisposable
{
    private const int Namespace = 724913;
    private readonly PaymentDbContext _db;
    private readonly int _orderId;
    private PaymentOrderLock(PaymentDbContext db, int orderId) { _db = db; _orderId = orderId; }

    public static async Task<PaymentOrderLock?> TryAcquireAsync(PaymentDbContext db, int orderId)
    {
        await db.Database.OpenConnectionAsync();
        try
        {
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText = $"SELECT pg_try_advisory_lock({Namespace}, {orderId})";
            if (await command.ExecuteScalarAsync() is true) return new PaymentOrderLock(db, orderId);
        }
        catch
        {
            await db.Database.CloseConnectionAsync();
            throw;
        }
        await db.Database.CloseConnectionAsync();
        return null;
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            await using var command = _db.Database.GetDbConnection().CreateCommand();
            command.CommandText = $"SELECT pg_advisory_unlock({Namespace}, {_orderId})";
            await command.ExecuteScalarAsync();
        }
        finally { await _db.Database.CloseConnectionAsync(); }
    }
}
