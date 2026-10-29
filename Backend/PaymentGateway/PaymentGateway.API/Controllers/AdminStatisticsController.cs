using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.API.Controllers;

[ApiController, Route("api/admin/statistics/products"), Authorize(Roles = "ADMIN,Admin,admin")]
public class AdminStatisticsController(PaymentDbContext db) : ControllerBase
{
    // Argentina currently uses UTC-03 throughout the year. API dates are local store dates.
    private static DateTime StartUtc(DateOnly date) => date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddHours(3);

    private static bool ValidRange(DateOnly? from, DateOnly? to) => from.HasValue && to.HasValue &&
        from.Value.Year < 9999 && to.Value.Year < 9999 && to >= from && to.Value.DayNumber - from.Value.DayNumber <= 3660;

    [HttpGet("{id:int}/sales")]
    public async Task<IActionResult> Sales(int id, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] string groupBy = "day", CancellationToken ct = default)
    {
        if (!ValidRange(from, to) || groupBy is not ("day" or "week" or "month"))
            return BadRequest(new { Message = "Indicá from y to (AAAA-MM-DD), un rango de hasta 3660 días y groupBy day, week o month." });
        var product = await db.Products.AsNoTracking().Where(p => p.IdProduct == id)
            .Select(p => new { p.IdProduct, p.ProductName, p.Type, p.IsDeleted }).SingleOrDefaultAsync(ct);
        if (product is null) return NotFound();
        var start = StartUtc(from!.Value);
        var end = StartUtc(to!.Value.AddDays(1));
        var items = db.OrderItems.AsNoTracking().Where(i => i.IdProduct == id && i.Order!.Status == "APPROVED" && !i.Order.ManuallyCancelled);
        var unknown = await items.Where(i => i.Order!.ApprovedAt == null).Select(i => i.IdOrder).Distinct().CountAsync(ct);
        // Aggregate in PostgreSQL; only daily totals cross the database boundary.
        var daily = await items.Where(i => i.Order!.ApprovedAt >= start && i.Order.ApprovedAt < end)
            .GroupBy(i => i.Order!.ApprovedAt!.Value.AddHours(-3).Date)
            .Select(g => new { Date = g.Key, Quantity = g.Sum(i => (long)i.Quantity),
                Revenue = g.Sum(i => i.FinalPrice * i.Quantity), MinPrice = g.Min(i => i.FinalPrice), MaxPrice = g.Max(i => i.FinalPrice) })
            .ToListAsync(ct);
        DateOnly Bucket(DateOnly date) => groupBy switch
        {
            "week" => date.AddDays(-(((int)date.DayOfWeek + 6) % 7)),
            "month" => new DateOnly(date.Year, date.Month, 1),
            _ => date
        };
        var grouped = daily.GroupBy(d => Bucket(DateOnly.FromDateTime(d.Date))).ToDictionary(g => g.Key);
        var periods = new List<ProductSalesPeriod>();
        for (var date = from.Value; date <= to.Value; date = date.AddDays(1))
        {
            var bucket = Bucket(date);
            if (periods.Count > 0 && periods[^1].PeriodStart == bucket) continue;
            var rows = grouped.GetValueOrDefault(bucket)?.ToList();
            var quantity = rows?.Sum(r => r.Quantity) ?? 0;
            var revenue = rows?.Sum(r => r.Revenue) ?? 0;
            periods.Add(new(bucket, quantity, revenue, quantity == 0 ? null : revenue / quantity,
                rows?.Min(r => r.MinPrice), rows?.Max(r => r.MaxPrice)));
        }
        var totalQuantity = periods.Sum(p => p.Quantity);
        var totalRevenue = periods.Sum(p => p.Revenue);
        return Ok(new { Product = product, From = from, To = to, GroupBy = groupBy, TimeZone = "America/Argentina/Cordoba",
            Currency = "ARS", Quantity = totalQuantity, Revenue = totalRevenue,
            AverageUnitPrice = totalQuantity == 0 ? (decimal?)null : totalRevenue / totalQuantity,
            ExcludedOrdersWithoutApprovalDate = unknown, Periods = periods });
    }

    [HttpGet("{id:int}/prices")]
    public async Task<IActionResult> Prices(int id, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct = default)
    {
        if (!ValidRange(from, to)) return BadRequest(new { Message = "Indicá from y to (AAAA-MM-DD) y un rango de hasta 3660 días." });
        if (!await db.Products.AnyAsync(p => p.IdProduct == id, ct)) return NotFound();
        var start = StartUtc(from!.Value);
        var end = StartUtc(to!.Value.AddDays(1));
        var history = db.ProductPriceHistory.AsNoTracking().Where(h => h.IdProduct == id);
        var previous = await history.Where(h => h.RecordedAt <= start).OrderByDescending(h => h.RecordedAt)
            .ThenByDescending(h => h.Id).FirstOrDefaultAsync(ct);
        var changes = await history.Where(h => h.RecordedAt > start && h.RecordedAt < end)
            .OrderBy(h => h.RecordedAt).ThenBy(h => h.Id).ToListAsync(ct);
        if (previous is not null) changes.Insert(0, previous);
        var periods = new List<ProductPricePeriod>();
        for (var i = 0; i < changes.Count; i++)
        {
            var change = changes[i];
            var segmentStart = change.RecordedAt < start ? start : change.RecordedAt;
            var segmentEnd = i + 1 < changes.Count ? changes[i + 1].RecordedAt : end;
            if (segmentEnd <= segmentStart) continue;
            var offered = change.DiscountPrice is > 0 && change.DiscountPrice < change.UnitPrice &&
                (change.DiscountEndDate is null || change.DiscountEndDate > segmentStart);
            var offerEnd = offered && change.DiscountEndDate < segmentEnd ? change.DiscountEndDate!.Value : segmentEnd;
            periods.Add(new(segmentStart, offerEnd, change.UnitPrice, offered ? change.DiscountPrice : null,
                offered ? change.DiscountPrice!.Value : change.UnitPrice, change.Reason));
            if (offerEnd < segmentEnd)
                periods.Add(new(offerEnd, segmentEnd, change.UnitPrice, null, change.UnitPrice, "OFFER_EXPIRED"));
        }
        return Ok(new { IdProduct = id, From = from, To = to, TimeZone = "America/Argentina/Cordoba", Currency = "ARS",
            CoverageStartsAt = periods.Count == 0 ? (DateTime?)null : periods[0].From,
            HasUnknownPrices = periods.Count == 0 || periods[0].From > start, Periods = periods });
    }
}

public sealed record ProductSalesPeriod(DateOnly PeriodStart, long Quantity, decimal Revenue,
    decimal? AverageUnitPrice, decimal? MinUnitPrice, decimal? MaxUnitPrice);

public sealed record ProductPricePeriod(DateTime From, DateTime To, decimal ListPrice,
    decimal? OfferPrice, decimal EffectivePrice, string Reason);
