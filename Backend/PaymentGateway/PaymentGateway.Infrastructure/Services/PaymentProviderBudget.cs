using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace PaymentGateway.Infrastructure.Services;

public sealed class PaymentProviderDeferredException(DateTime retryAt) : HttpRequestException("La consulta de pago fue reprogramada para respetar el presupuesto del proveedor.")
{
    public DateTime RetryAt { get; } = retryAt;
}

public static class PaymentRequestPriority
{
    private static readonly AsyncLocal<bool> Current = new();
    public static bool IsUrgent => Current.Value;
    public static IDisposable Urgent() { var previous = Current.Value; Current.Value = true; return new Reset(previous); }
    private sealed class Reset(bool previous) : IDisposable { public void Dispose() => Current.Value = previous; }
}

public sealed class PaymentProviderBudget(IConnectionMultiplexer redis, IConfiguration config, IOptions<PaymentTrackingOptions> options)
{
    private string Key => "payment-provider:{" + Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(
        (config["MercadoPago:AccessToken"] ?? config["MercadoPago:AccesToken"] ?? throw new InvalidOperationException("Falta el token de pagos.")).Trim()))) + "}:budget";
    private const string AcquireScript = """
        local t = redis.call('TIME'); local now = t[1]*1000 + math.floor(t[2]/1000)
        local state = redis.call('HMGET', KEYS[1], 'window', 'count', 'background', 'tokens', 'last', 'blocked')
        local blocked = tonumber(state[6]) or 0
        if blocked > now then return blocked-now end
        local window = math.floor(now/60000); local count = tonumber(state[2]) or 0; local background = tonumber(state[3]) or 0
        if tonumber(state[1]) ~= window then count=0; background=0 end
        local limit=tonumber(ARGV[1]); local bgLimit=tonumber(ARGV[2]); local burst=tonumber(ARGV[3]); local urgent=tonumber(ARGV[4])
        if count >= limit or (urgent == 0 and background >= bgLimit) then return (window+1)*60000-now end
        local tokens=math.min(burst, (tonumber(state[4]) or burst) + (now-(tonumber(state[5]) or now))*limit/60000)
        if tokens < 1 then return math.ceil((1-tokens)*60000/limit) end
        redis.call('HSET', KEYS[1], 'window',window,'count',count+1,'background',background+(1-urgent),'tokens',tokens-1,'last',now)
        redis.call('PEXPIRE',KEYS[1],120000)
        return 0
        """;
    public async Task AcquireAsync(bool urgent)
    {
        try
        {
            var limits = options.Value;
            var wait = (long)await redis.GetDatabase().ScriptEvaluateAsync(AcquireScript, [Key],
                [limits.ProviderRequestsPerMinute, limits.BackgroundRequestsPerMinute, limits.ProviderBurst, urgent ? 1 : 0]);
            if (wait > 0) throw new PaymentProviderDeferredException(DateTime.UtcNow.AddMilliseconds(wait + Random.Shared.Next(25, 250)));
        }
        catch (Exception ex) when (ex is RedisException or TimeoutException)
        { throw new PaymentProviderDeferredException(DateTime.UtcNow.AddSeconds(5)); }
    }
    public async Task BlockAsync(TimeSpan delay)
    {
        const string script = """
            local t=redis.call('TIME'); local now=t[1]*1000+math.floor(t[2]/1000)
            local untilAt=now+tonumber(ARGV[1]); local old=tonumber(redis.call('HGET',KEYS[1],'blocked')) or 0
            redis.call('HSET',KEYS[1],'blocked',math.max(old,untilAt)); redis.call('PEXPIRE',KEYS[1],math.max(old,untilAt)-now+120000)
            """;
        await redis.GetDatabase().ScriptEvaluateAsync(script, [Key], [(long)delay.TotalMilliseconds]);
    }
}
