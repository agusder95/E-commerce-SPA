using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace PaymentGateway.Domain.Entities;

public class DigitalFile
{
    [Required, MaxLength(500)] public string Key { get; set; } = "";
    [Required, MaxLength(255)] public string Name { get; set; } = "";
}

public static class DigitalFileCollection
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public static List<DigitalFile> Read(string? json, string? legacyKey)
    {
        if (!string.IsNullOrWhiteSpace(json))
        {
            try
            {
                var files = JsonSerializer.Deserialize<List<DigitalFile>>(json, Options);
                if (files is { Count: > 0 }) return files.Where(file => file is not null && !string.IsNullOrWhiteSpace(file.Key)).ToList();
            }
            catch (JsonException) { }
        }
        return string.IsNullOrWhiteSpace(legacyKey) ? [] :
            [new DigitalFile { Key = legacyKey, Name = Path.GetFileName(legacyKey) }];
    }

    public static string Write(IEnumerable<DigitalFile> files) => JsonSerializer.Serialize(files, Options);
}
