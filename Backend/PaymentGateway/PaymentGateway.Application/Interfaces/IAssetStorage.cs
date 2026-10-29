namespace PaymentGateway.Application.Interfaces;

public interface IAssetStorage
{
    Task<string> UploadImageAsync(Stream stream, string fileName, CancellationToken cancellationToken);
    Task<string> UploadImageFromUrlAsync(string url, CancellationToken cancellationToken);
    Task<string> UploadDigitalFileAsync(Stream stream, string fileName, string contentType, CancellationToken cancellationToken);
    string CreateDownloadUrl(string key);
    string CreatePreviewUrl(string key);
}
