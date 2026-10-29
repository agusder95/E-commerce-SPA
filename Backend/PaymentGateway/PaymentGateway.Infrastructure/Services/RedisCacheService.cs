using Microsoft.Extensions.Caching.Distributed;
using PaymentGateway.Application.Interfaces;

namespace PaymentGateway.Infrastructure.Services;

public class RedisCacheService : ICacheService
{
    private readonly IDistributedCache _cache;

    public RedisCacheService(IDistributedCache cache)
    {
        _cache = cache;
    }

    public async Task SetCacheValueAsync(string key, string value, TimeSpan expirationTime)
    {
        var options = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = expirationTime,
        };

        await _cache.SetStringAsync(key, value, options);
    }

    public async Task<string?> GetCacheValueAsync(string key)
    {
        return await _cache.GetStringAsync(key);
    }

    public async Task RemoveCacheValueAsync(string key)
    {
        await _cache.RemoveAsync(key);
    }
}
