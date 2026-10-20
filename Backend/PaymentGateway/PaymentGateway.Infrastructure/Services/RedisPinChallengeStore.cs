using Microsoft.Extensions.Options;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using StackExchange.Redis;

namespace PaymentGateway.Infrastructure.Services;

public sealed class RedisPinChallengeStore(IConnectionMultiplexer redis, IOptions<PinLoginOptions> options) : IPinChallengeStore
{
    private readonly PinLoginOptions _options = options.Value;
    // One hash slot allows atomic account + IP limits even on Redis Cluster.
    private string Root(string subject) => _options.RedisKeyPrefix + "{pin-login}:email:" + subject;
    private string Ip(string client, string action) => _options.RedisKeyPrefix + "{pin-login}:ip:" + client + ":" + action;

    private const string QuotaScript = """
        local function retry(key)
            local ttl = redis.call('PTTL', key)
            return math.max(1, math.ceil(ttl / 1000))
        end
        local function quota(key, limit, window)
            if tonumber(redis.call('GET', key) or '0') >= tonumber(limit) then return retry(key) end
            local count = redis.call('INCR', key)
            if count == 1 then redis.call('PEXPIRE', key, window) end
            return 0
        end
        """;

    private const string IssueScript = QuotaScript + "\n" + """
        local ip = quota(KEYS[1], ARGV[1], ARGV[3])
        if ip > 0 then return {3, ip} end
        if redis.call('EXISTS', KEYS[2]) == 1 then return {3, retry(KEYS[2])} end
        if redis.call('EXISTS', KEYS[3]) == 1 then return {3, retry(KEYS[3])} end
        local email = quota(KEYS[4], ARGV[2], ARGV[3])
        if email > 0 then return {3, email} end
        redis.call('HSET', KEYS[5], 'challenge', ARGV[6], 'proof', ARGV[7], 'failures', 0)
        redis.call('PEXPIRE', KEYS[5], ARGV[4])
        redis.call('SET', KEYS[3], ARGV[6], 'PX', ARGV[5])
        return {0, 0}
        """;

    private const string ConsumeScript = QuotaScript + "\n" + """
        local ip = quota(KEYS[1], ARGV[1], ARGV[3])
        if ip > 0 then return {3, ip} end
        if redis.call('EXISTS', KEYS[2]) == 1 then return {3, retry(KEYS[2])} end
        local email = quota(KEYS[3], ARGV[2], ARGV[3])
        if email > 0 then return {3, email} end
        local stored = redis.call('HMGET', KEYS[4], 'challenge', 'proof')
        if not stored[1] or not stored[2] then return {2, 0} end
        local equal = #stored[2] == #ARGV[7]
        local difference = 0
        if equal then
            for i = 1, #stored[2] do
                difference = bit.bor(difference, bit.bxor(string.byte(stored[2], i), string.byte(ARGV[7], i)))
            end
        end
        if stored[1] == ARGV[6] and equal and difference == 0 then
            redis.call('DEL', KEYS[4])
            return {1, 0}
        end
        local failures = redis.call('HINCRBY', KEYS[4], 'failures', 1)
        if failures >= tonumber(ARGV[4]) then
            redis.call('DEL', KEYS[4])
            redis.call('SET', KEYS[2], '1', 'PX', ARGV[5])
            return {3, retry(KEYS[2])}
        end
        return {2, 0}
        """;

    public async Task<PinAttemptResult> TryIssueAsync(string subject, string client, string challengeId, string proof)
    {
        var root = Root(subject);
        var result = await redis.GetDatabase().ScriptEvaluateAsync(IssueScript,
            [Ip(client, "request"), root + ":lock", root + ":cooldown", root + ":requests", root + ":challenge"],
            [_options.MaxRequestsPerIp, _options.MaxRequestsPerEmail, _options.WindowSeconds * 1000,
                _options.LifetimeSeconds * 1000, _options.ResendSeconds * 1000, challengeId, proof]);
        return Parse(result);
    }

    public async Task<string?> GetChallengeIdAsync(string subject) =>
        await redis.GetDatabase().HashGetAsync(Root(subject) + ":challenge", "challenge");

    public async Task<PinAttemptResult> TryConsumeAsync(string subject, string client, string? challengeId, string proof)
    {
        var root = Root(subject);
        var result = await redis.GetDatabase().ScriptEvaluateAsync(ConsumeScript,
            [Ip(client, "verify"), root + ":lock", root + ":verifications", root + ":challenge"],
            [_options.MaxVerificationsPerIp, _options.MaxVerificationsPerEmail, _options.WindowSeconds * 1000,
                _options.MaxFailedAttempts, _options.LockoutSeconds * 1000, challengeId ?? "", proof]);
        return Parse(result);
    }

    public async Task RevokeAsync(string subject, string challengeId)
    {
        var root = Root(subject);
        await redis.GetDatabase().ScriptEvaluateAsync("""
            if redis.call('HGET', KEYS[1], 'challenge') == ARGV[1] then redis.call('DEL', KEYS[1]) end
            if redis.call('GET', KEYS[2]) == ARGV[1] then redis.call('DEL', KEYS[2]) end
            return 1
            """, [root + ":challenge", root + ":cooldown"], [challengeId]);
    }

    private static PinAttemptResult Parse(RedisResult result)
    {
        var values = (RedisResult[])result!;
        return new((PinAttemptStatus)(int)values[0], (int)values[1]);
    }
}
