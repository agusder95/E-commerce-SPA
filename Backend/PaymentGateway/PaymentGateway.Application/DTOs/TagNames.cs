using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace PaymentGateway.Application.DTOs;

public static class TagNames
{
    public static string Canonical(string value)
    {
        var name = Regex.Replace(value.Trim().Normalize(NormalizationForm.FormC), @"\s+", " ").ToLowerInvariant();
        return name.Length == 0 ? name : char.ToUpperInvariant(name[0]) + name[1..];
    }

    public static string Key(string value) => string.Concat(Canonical(value).Normalize(NormalizationForm.FormD)
        .Where(character => CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark))
        .Normalize(NormalizationForm.FormC).ToUpperInvariant();

    public static bool IsAutomatic(string name) => Key(name) is "FISICO" or "DIGITAL";
}
