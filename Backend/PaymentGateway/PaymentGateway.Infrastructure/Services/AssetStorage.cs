using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;
using PaymentGateway.Application.Interfaces;

namespace PaymentGateway.Infrastructure.Services;

public sealed class AssetStorage(IConfiguration config, HttpClient http) : IAssetStorage
{
    private string Setting(string key)
    {
        var value = config[key];
        if (string.IsNullOrWhiteSpace(value) || value.StartsWith("replace-", StringComparison.Ordinal))
            throw new InvalidOperationException($"Falta configurar {key} en el backend.");
        return value;
    }

    public Task<string> UploadImageAsync(Stream stream, string fileName, CancellationToken cancellationToken) =>
        UploadImageContentAsync(new StreamContent(stream), Path.GetFileName(fileName), cancellationToken);

    public Task<string> UploadImageFromUrlAsync(string url, CancellationToken cancellationToken) =>
        UploadImageContentAsync(new StringContent(url), null, cancellationToken);

    private async Task<string> UploadImageContentAsync(HttpContent content, string? fileName, CancellationToken cancellationToken)
    {
        var cloud = Setting("Cloudinary:CloudName");
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        var signature = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
            $"timestamp={timestamp}{Setting("Cloudinary:ApiSecret")}"))).ToLowerInvariant();
        using var form = new MultipartFormDataContent();
        if (fileName is null) form.Add(content, "file");
        else form.Add(content, "file", fileName);
        form.Add(new StringContent(Setting("Cloudinary:ApiKey")), "api_key");
        form.Add(new StringContent(timestamp), "timestamp");
        form.Add(new StringContent(signature), "signature");
        using var response = await http.PostAsync($"https://api.cloudinary.com/v1_1/{Uri.EscapeDataString(cloud)}/image/upload", form, cancellationToken);
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return json.RootElement.GetProperty("secure_url").GetString()!;
    }

    private AmazonS3Client R2Client() => new(new BasicAWSCredentials(
        Setting("R2:AccessKeyId"), Setting("R2:SecretAccessKey")), new AmazonS3Config
        {
            ServiceURL = $"https://{Setting("R2:AccountId")}.r2.cloudflarestorage.com",
            AuthenticationRegion = "auto",
            ForcePathStyle = true,
        });

    public async Task<string> UploadDigitalFileAsync(Stream stream, string fileName, string contentType, CancellationToken cancellationToken)
    {
        var key = $"products/{Guid.NewGuid():N}/{Path.GetFileName(fileName)}";
        using var client = R2Client();
        await client.PutObjectAsync(new PutObjectRequest
        {
            BucketName = Setting("R2:BucketName"), Key = key, InputStream = stream,
            ContentType = contentType, DisablePayloadSigning = true,
            DisableDefaultChecksumValidation = true,
        }, cancellationToken);
        return key;
    }

    public string CreateDownloadUrl(string key) => CreateSignedUrl(key, false);

    public string CreatePreviewUrl(string key) => CreateSignedUrl(key, true);

    private string CreateSignedUrl(string key, bool preview)
    {
        using var client = R2Client();
        var headers = new ResponseHeaderOverrides { ContentDisposition = preview ? "inline" : "attachment" };
        if (preview && key.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)) headers.ContentType = "application/pdf";
        return client.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName = Setting("R2:BucketName"), Key = key, Verb = HttpVerb.GET,
            Expires = DateTime.UtcNow.AddMinutes(10),
            ResponseHeaderOverrides = headers,
        });
    }
}
