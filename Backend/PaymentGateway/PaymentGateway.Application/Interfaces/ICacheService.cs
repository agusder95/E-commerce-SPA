namespace PaymentGateway.Application.Interfaces;

public interface ICacheService
{
    Task SetCacheValueAsync(string key, string value, TimeSpan expiration);
    Task<string?> GetCacheValueAsync(string key);

    Task RemoveCacheValueAsync(string key);
}
