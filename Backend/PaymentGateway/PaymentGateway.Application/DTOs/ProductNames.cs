using System.Text;
using System.Text.RegularExpressions;

namespace PaymentGateway.Application.DTOs;

public static class ProductNames
{
    public static string Key(string value) => Regex.Replace(value.Trim().Normalize(NormalizationForm.FormC), @"\s+", " ").ToUpperInvariant();

    public static string Capitalize(string value) => Regex.Replace(
        value.Trim().Normalize(NormalizationForm.FormC).ToLowerInvariant(),
        @"(^|[^\p{L}\p{M}\p{N}])(\p{L})",
        match => match.Groups[1].Value + match.Groups[2].Value.ToUpperInvariant());
}
