using System.Text.Json;
using System.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;

namespace PaymentGateway.API.Controllers;

[ApiController, Route("api/admin"), Authorize(Roles = "ADMIN,Admin,admin")]
public class AdminController(PaymentDbContext db, IAssetStorage storage) : ControllerBase
{
    [HttpGet("tags")]
    public async Task<IActionResult> Tags() => Ok(await db.Tags.AsNoTracking()
        .Where(tag => tag.NormalizedName != "FISICO" && tag.NormalizedName != "DIGITAL")
        .OrderBy(tag => tag.Name).Select(tag => new { tag.IdTag, tag.Name }).ToListAsync());

    [HttpPost("tags")]
    public async Task<IActionResult> CreateTag(CreateTagRequest request)
    {
        var name = TagNames.Canonical(request.Name);
        if (name.Length == 0 || name.Length > 15)
            return BadRequest(new { Message = "El tag debe tener entre 1 y 15 caracteres." });
        if (TagNames.IsAutomatic(name))
            return BadRequest(new { Message = "Físico y Digital se asignan automáticamente; no se pueden crear ni seleccionar." });
        var key = TagNames.Key(name);
        if (await db.Tags.AnyAsync(tag => tag.NormalizedName == key))
            return Conflict(new { Message = "Ese tag ya existe (sin distinguir mayúsculas ni acentos)." });
        var tag = new Tag { Name = name };
        db.Tags.Add(tag);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: "23505" })
        {
            db.Entry(tag).State = EntityState.Detached;
            return Conflict(new { Message = "Ese tag ya existe (sin distinguir mayúsculas ni acentos)." });
        }
        return Ok(new { tag.IdTag, tag.Name });
    }

    [HttpPost("tags/delete")]
    public async Task<IActionResult> DeleteTags(DeleteTagsRequest request)
    {
        var ids = request.Ids.Distinct().ToList();
        if (ids.Count == 0 || ids.Count > 500 || ids.Any(id => id <= 0))
            return BadRequest(new { Message = "Seleccioná entre 1 y 500 tags personalizados." });
        try
        {
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var tags = await db.Tags.Where(tag => ids.Contains(tag.IdTag)).ToListAsync();
            if (tags.Count != ids.Count) return Conflict(new { Message = "Uno de los tags ya no existe. Actualizá la lista." });
            if (tags.Any(tag => TagNames.IsAutomatic(tag.Name)))
                return BadRequest(new { Message = "Físico y Digital son tags automáticos y no se pueden eliminar." });
            var keys = tags.Select(tag => TagNames.Key(tag.Name)).ToHashSet();
            var products = await db.Products.Where(product => product.Tags != null).ToListAsync();
            var updated = 0;
            foreach (var product in products)
            {
                var previous = CouponRules.ReadTags(product.Tags);
                var remaining = previous.Where(name => !keys.Contains(TagNames.Key(name))).ToList();
                if (remaining.Count == previous.Count) continue;
                product.Tags = JsonSerializer.Serialize(remaining); updated++;
            }
            db.Tags.RemoveRange(tags);
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(new { Message = "Tags eliminados y quitados de los productos que los contenían.", UpdatedProducts = updated });
        }
        catch (Exception exception) when (exception is PostgresException { SqlState: "40001" or "40P01" } ||
            exception is DbUpdateException { InnerException: PostgresException { SqlState: "40001" or "40P01" } })
        {
            return Conflict(new { Message = "Los tags o sus productos cambiaron durante la operación. Actualizá la lista y volvé a intentar." });
        }
    }

    [HttpGet("products")]
    public async Task<IActionResult> Products([FromQuery] bool includeDeleted = false) => Ok((await db.Products.AsNoTracking()
        .Where(p => includeDeleted || !p.IsDeleted).OrderByDescending(p => p.CreatedAt).ToListAsync())
        .Select(p => new { Product = ProductResponseDTO.FromEntity(p), p.DigitalFileKey,
            DigitalFiles = DigitalFileCollection.Read(p.DigitalFiles, p.DigitalFileKey), p.IsDeleted }));

    [HttpPost("products/status")]
    public async Task<IActionResult> ChangeStatus(ProductStatusRequest request)
    {
        var ids = request.Ids.Distinct().ToList();
        if (ids.Count == 0 || ids.Count > 500)
            return BadRequest(new { Message = "Seleccioná entre 1 y 500 productos." });
        await using var transaction = await db.Database.BeginTransactionAsync();
        var products = await db.Products.Where(p => ids.Contains(p.IdProduct)).ToListAsync();
        if (products.Count != ids.Count) return NotFound(new { Message = "Uno de los productos ya no existe." });
        foreach (var product in products) product.IsDeleted = request.Deleted;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return NoContent();
    }

    [HttpPost("assets/image-url")]
    public async Task<IActionResult> ImageUrl(ImportImageRequest request, CancellationToken ct)
    {
        if (!Uri.TryCreate(request.Url, UriKind.Absolute, out var uri) || uri.Scheme != "https" ||
            uri.IsLoopback || !string.IsNullOrEmpty(uri.UserInfo))
            return BadRequest(new { Message = "Ingresá una URL pública HTTPS de una imagen." });
        return Ok(new { Url = await storage.UploadImageFromUrlAsync(uri.AbsoluteUri, ct) });
    }

    [HttpPost("products")]
    public Task<IActionResult> Create(SaveProductRequest request) => Save(null, request);

    [HttpPut("products/{id:int}")]
    public Task<IActionResult> Update(int id, SaveProductRequest request) => Save(id, request);

    private async Task<IActionResult> Save(int? id, SaveProductRequest request)
    {
        try { return await SaveProduct(id, request); }
        catch (Exception exception) when (exception is PostgresException { SqlState: "40001" or "40P01" } ||
            exception is DbUpdateException { InnerException: PostgresException { SqlState: "40001" or "40P01" } })
        {
            return Conflict(new { Message = "El producto o sus tags cambiaron mientras lo guardabas. Actualizá los datos y volvé a intentar." });
        }
    }

    private async Task<IActionResult> SaveProduct(int? id, SaveProductRequest request)
    {
        if (request.Type == "BOTH" && request.DigitalUnitPrice is not > 0)
            return BadRequest(new { Message = "Ingresá un precio para la variante digital." });
        var imageUrls = request.Gallery.Concat(string.IsNullOrWhiteSpace(request.Thumbnail) ? [] : new[] { request.Thumbnail });
        if (imageUrls.Any(url => !Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            uri.Scheme != "https" || uri.Host != "res.cloudinary.com"))
            return BadRequest(new { Message = "Las imágenes deben ser URLs HTTPS de Cloudinary." });
        var files = request.DigitalFiles.Count > 0 ? request.DigitalFiles : DigitalFileCollection.Read(null, request.DigitalFileKey);
        if ((request.Type is "DIGITAL" or "BOTH") && (files.Count == 0 || files.Count > 50 ||
            files.Any(file => file is null || string.IsNullOrWhiteSpace(file.Name) || file.Name.Length > 255 ||
                string.IsNullOrWhiteSpace(file.Key) || file.Key.Length > 500 || !file.Key.StartsWith("products/", StringComparison.Ordinal)) ||
            files.Select(file => file.Key).Distinct().Count() != files.Count))
            return BadRequest(new { Message = "Subí entre 1 y 50 archivos digitales a R2, sin duplicados, antes de guardar." });
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var selectedIds = request.TagIds.Distinct().ToList();
        var selectedTags = await db.Tags.Where(tag => selectedIds.Contains(tag.IdTag)).ToListAsync();
        if (selectedTags.Count != selectedIds.Count || selectedTags.Any(tag => TagNames.IsAutomatic(tag.Name)))
            return BadRequest(new { Message = "Seleccioná tags existentes. Físico y Digital se asignan automáticamente." });
        var automaticTags = await db.Tags.Where(tag => tag.NormalizedName == "FISICO" || tag.NormalizedName == "DIGITAL").ToListAsync();
        if (automaticTags.Count != 2)
            return BadRequest(new { Message = "Aplicá la migración de tags para habilitar Físico y Digital." });
        var existing = id.HasValue ? await db.Products.FirstOrDefaultAsync(p => p.IdProduct == id && !p.IsDeleted) : null;
        if (id.HasValue && existing is null) return NotFound();
        if (existing is not null && request.Type == "BOTH")
        {
            var otherType = existing.Type == "PHYSICAL" ? "DIGITAL" : "PHYSICAL";
            var candidates = await db.Products.AsNoTracking().Where(p => p.IdProduct != id && p.Type == otherType)
                .Select(p => new { p.ProductName, p.IsDeleted }).ToListAsync();
            var nameKey = ProductNames.Key(request.ProductName);
            var other = candidates.FirstOrDefault(p => ProductNames.Key(p.ProductName) == nameKey);
            if (other is not null) return Conflict(new { Message = other.IsDeleted
                ? "La otra variante ya existe y está eliminada. Restaurala desde Borrar; no se creará un duplicado."
                : "La otra variante ya existe. Editala por separado; no se creará un duplicado." });
        }
        var offerPrice = request.Type == "BOTH" && existing is not null ? existing.DiscountPrice : request.DiscountPrice;
        var offerEnd = request.Type == "BOTH" && existing is not null ? existing.DiscountEndDate : request.DiscountEndDate;
        var offerBasePrice = existing?.Type == "DIGITAL" && request.Type == "BOTH" ? request.DigitalUnitPrice : request.UnitPrice;
        if (offerPrice >= offerBasePrice)
            return BadRequest(new { Message = "El precio de oferta debe ser menor al precio original." });
        var thumbnail = string.IsNullOrWhiteSpace(request.Thumbnail) ? request.Gallery.FirstOrDefault() : request.Thumbnail;
        if (thumbnail is not null && !request.Gallery.Contains(thumbnail)) request.Gallery.Insert(0, thumbnail);
        var types = request.Type == "BOTH" ? new[] { "PHYSICAL", "DIGITAL" } : new[] { request.Type };
        var saved = new List<Product>();
        foreach (var type in types)
        {
            var product = existing is not null && (request.Type != "BOTH" || existing.Type == type) ? existing : new Product();
            product.ProductName = id.HasValue ? request.ProductName.Trim() : ProductNames.Capitalize(request.ProductName);
            product.UnitPrice = type == "DIGITAL" && request.Type == "BOTH" ? request.DigitalUnitPrice!.Value : request.UnitPrice;
            product.Stock = type == "PHYSICAL" ? request.Stock : 0;
            product.Type = type;
            product.Description = request.Description;
            product.Thumbnail = thumbnail;
            var automaticName = automaticTags.Single(tag => tag.NormalizedName == (type == "PHYSICAL" ? "FISICO" : "DIGITAL")).Name;
            product.Tags = JsonSerializer.Serialize(selectedTags.Select(tag => tag.Name).Append(automaticName));
            product.Gallery = JsonSerializer.Serialize(request.Gallery);
            product.DigitalFileKey = type == "DIGITAL" ? files[0].Key : null;
            product.DigitalFiles = type == "DIGITAL" ? DigitalFileCollection.Write(files) : null;
            var ownsOffer = request.Type != "BOTH" || (existing is null ? type == "PHYSICAL" : product == existing);
            product.DiscountPrice = ownsOffer ? offerPrice : null;
            product.DiscountEndDate = ownsOffer ? offerEnd?.ToUniversalTime() : null;
            if (product.IdProduct == 0) db.Products.Add(product);
            saved.Add(product);
        }
        try
        {
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (Exception exception) when (exception is PostgresException { SqlState: "40001" } ||
            exception is DbUpdateException { InnerException: PostgresException { SqlState: "40001" } })
        {
            return Conflict(new { Message = "El producto cambió mientras guardabas. Recargá la lista y volvé a intentar." });
        }
        return request.Type == "BOTH" ? Ok(saved.Select(ProductResponseDTO.FromEntity)) : Ok(ProductResponseDTO.FromEntity(saved[0]));
    }

    [HttpDelete("products/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var product = await db.Products.FindAsync(id);
        if (product is null) return NotFound();
        product.IsDeleted = true;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("assets/image"), RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> Image(IFormFile file, CancellationToken ct)
    {
        if (file.Length == 0 || file.Length > 10 * 1024 * 1024 ||
            !new[] { "image/jpeg", "image/png", "image/webp", "image/gif" }.Contains(file.ContentType))
            return BadRequest(new { Message = "Usá JPG, PNG, WebP o GIF de hasta 10 MB." });
        await using var stream = file.OpenReadStream();
        return Ok(new { Url = await storage.UploadImageAsync(stream, file.FileName, ct) });
    }

    [HttpPost("assets/digital"), RequestSizeLimit(100 * 1024 * 1024), RequestFormLimits(MultipartBodyLengthLimit = 100 * 1024 * 1024)]
    public async Task<IActionResult> Digital(IFormFile file, CancellationToken ct)
    {
        if (file.Length == 0 || file.Length > 100 * 1024 * 1024)
            return BadRequest(new { Message = "El archivo debe tener entre 1 byte y 100 MB." });
        await using var stream = file.OpenReadStream();
        return Ok(new { Key = await storage.UploadDigitalFileAsync(stream, file.FileName, file.ContentType, ct) });
    }

    [HttpGet("assets/digital-preview")]
    public IActionResult DigitalPreview([FromQuery] string key)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length > 500 || !key.StartsWith("products/", StringComparison.Ordinal))
            return BadRequest(new { Message = "La referencia del archivo digital no es válida." });
        return Ok(new { Url = storage.CreatePreviewUrl(key) });
    }

    [HttpGet("orders")]
    public async Task<IActionResult> Orders() => Ok(await db.Orders.AsNoTracking().OrderByDescending(o => o.DatePurchase)
        .Select(o => new { o.IdOrder, Email = o.Customer!.Email, o.Status, o.TotalAmount, o.DatePurchase, o.ApprovedAt,
            o.SubTotal, o.CouponCodeUsed, o.GlobalDiscount, o.ManuallyCancelled, o.PreviousStatus,
            Items = o.Items.Select(i => new { i.IdOrderItem, i.ProductName, i.Quantity, i.OriginalUnitPrice,
                i.IdProduct, i.FinalPrice, i.BeforeCouponUnitPrice, i.DiscountApplied, i.ProductDiscount, i.ProductType }) }).ToListAsync());

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard([FromQuery] DateOnly? from = null, [FromQuery] DateOnly? to = null,
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(-3));
        if (from is null && to is null) from = to = today;
        if (!from.HasValue || !to.HasValue || from > to || to > today || to.Value.DayNumber - from.Value.DayNumber > 3660)
            return BadRequest(new { Message = "Elegí Desde y Hasta válidos, hasta hoy y con un rango máximo de 10 años." });
        var start = from.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddHours(3);
        var end = to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddHours(3);
        var approved = db.Orders.AsNoTracking().Where(o => o.Status == "APPROVED" && !o.ManuallyCancelled);
        var period = approved.Where(o => o.ApprovedAt >= start && o.ApprovedAt < end);
        var totals = await period.GroupBy(o => 1).Select(g => new { Sales = g.Sum(o => o.TotalAmount), Purchases = g.Count() })
            .SingleOrDefaultAsync(ct);
        var units = await db.OrderItems.AsNoTracking()
            .Where(i => i.Order!.Status == "APPROVED" && !i.Order.ManuallyCancelled && i.Order.ApprovedAt >= start && i.Order.ApprovedAt < end)
            .GroupBy(i => i.IdProduct).Select(g => new { Id = g.Key, Quantity = g.Sum(i => (long)i.Quantity) }).ToListAsync(ct);
        var quantities = units.ToDictionary(p => p.Id, p => p.Quantity);
        var products = await db.Products.AsNoTracking().Select(p => new { p.IdProduct, p.ProductName, p.Type, p.CreatedAt, p.IsDeleted }).ToListAsync(ct);
        var ranking = products.Where(p => p.CreatedAt < end || quantities.ContainsKey(p.IdProduct)).Select(p =>
        {
            var created = DateOnly.FromDateTime(p.CreatedAt.AddHours(-3));
            var availableFrom = created > from.Value ? created : from.Value;
            var days = Math.Max(1, to.Value.DayNumber - availableFrom.DayNumber + 1);
            var quantity = quantities.GetValueOrDefault(p.IdProduct);
            return new DashboardProduct(p.IdProduct, p.ProductName, p.Type, p.CreatedAt, p.IsDeleted, quantity, days, (decimal)quantity / days);
        }).ToList();
        return Ok(new { From = from, To = to, TimeZone = "America/Argentina/Cordoba", Currency = "ARS",
            Sales = totals?.Sales ?? 0, Purchases = totals?.Purchases ?? 0,
            Products = products.Count(p => !p.IsDeleted), Quantity = units.Sum(p => p.Quantity),
            Average = totals is null ? 0 : totals.Sales / totals.Purchases,
            TopProducts = ranking.Where(p => p.Quantity > 0).OrderByDescending(p => p.Quantity).ThenBy(p => p.Id).Take(3),
            LeastSoldProducts = ranking.Where(p => !p.IsDeleted).OrderBy(p => p.UnitsPerDay)
                .ThenBy(p => p.Quantity).ThenByDescending(p => p.AvailableDays).ThenBy(p => p.Id).Take(3),
            ExcludedOrdersWithoutApprovalDate = await approved.CountAsync(o => o.ApprovedAt == null, ct) });
    }

    [HttpGet("coupons")]
    public async Task<IActionResult> Coupons()
    {
        var coupons = await db.Coupons.AsNoTracking().OrderBy(c => c.Code).ToListAsync();
        return Ok(coupons.Select(c => new { c.IdCoupon, c.Code, c.Discount, c.ExpirationDate, c.CreatedAt,
            c.IsActive, c.Cumulative, c.ProductType, Tags = CouponRules.ReadTags(c.Tags), c.Used }));
    }

    [HttpPost("coupons")]
    public Task<IActionResult> Coupon(SaveCouponRequest request) => SaveCoupon(null, request);

    [HttpPut("coupons/{id:int}")]
    public Task<IActionResult> UpdateCoupon(int id, SaveCouponRequest request) => SaveCoupon(id, request);

    private async Task<IActionResult> SaveCoupon(int? id, SaveCouponRequest request)
    {
        var code = CouponRules.NormalizeCode(request.Code);
        if (decimal.Round(request.Discount, 2) != request.Discount)
            return BadRequest(new { Message = "El porcentaje admite hasta dos decimales." });
        if (code.Length == 0 || code.Length > 50) return BadRequest(new { Message = "Ingresá un código de hasta 50 caracteres." });
        if (request.ProductType is not null && request.ProductType is not "PHYSICAL" and not "DIGITAL")
            return BadRequest(new { Message = "Seleccioná un tipo de producto válido." });
        if (request.ExpirationDate is not null && request.ExpirationDate.Value.ToUniversalTime() <= DateTime.UtcNow)
            return BadRequest(new { Message = "La fecha de expiración debe ser actual o futura." });
        var codes = await db.Coupons.AsNoTracking().Select(c => new { c.IdCoupon, c.Code }).ToListAsync();
        if (codes.Any(c => c.IdCoupon != id && CouponRules.NormalizeCode(c.Code) == code))
            return Conflict(new { Message = "Ese código ya existe." });
        var tagIds = request.TagIds.Distinct().ToList();
        var tags = await db.Tags.Where(tag => tagIds.Contains(tag.IdTag)).ToListAsync();
        if (tags.Count != tagIds.Count) return BadRequest(new { Message = "Seleccioná tags existentes." });
        var coupon = id.HasValue ? await db.Coupons.FindAsync(id.Value) : new Coupon();
        if (coupon is null) return NotFound();
        coupon.Code = code;
        coupon.Discount = request.Discount;
        coupon.ExpirationDate = request.ExpirationDate?.ToUniversalTime();
        coupon.IsActive = request.IsActive;
        coupon.Cumulative = request.Cumulative;
        coupon.ProductType = request.ProductType;
        coupon.Tags = tags.Count > 0 ? JsonSerializer.Serialize(tags.Select(tag => tag.Name)) : null;
        if (!id.HasValue) db.Coupons.Add(coupon);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: "23505" })
        { return Conflict(new { Message = "Ese código ya existe." }); }
        return Ok(coupon);
    }

    [HttpPut("products/offers")]
    public async Task<IActionResult> ProductOffers(ProductOffersRequest request)
    {
        if (request.Ids.Count == 0) return BadRequest(new { Message = "Seleccioná al menos un producto." });
        if (!request.Remove && (request.Discount is < 1 or > 99 || decimal.Round(request.Discount, 2) != request.Discount || request.ExpirationDate is null ||
            request.ExpirationDate.Value.ToUniversalTime() <= DateTime.UtcNow))
            return BadRequest(new { Message = "Ingresá un porcentaje entre 1 y 99 y una fecha de expiración actual o futura." });
        var ids = request.Ids.Distinct().ToList();
        var products = await db.Products.Where(p => ids.Contains(p.IdProduct) && !p.IsDeleted).ToListAsync();
        if (products.Count != ids.Count) return NotFound(new { Message = "Uno de los productos ya no está disponible." });
        foreach (var product in products)
        {
            var price = decimal.Round(product.UnitPrice * (1 - request.Discount / 100), 2, MidpointRounding.AwayFromZero);
            if (!request.Remove && (price <= 0 || price >= product.UnitPrice))
                return BadRequest(new { Message = $"El descuento debe dejar un precio positivo menor al original para {product.ProductName}." });
            product.DiscountPrice = request.Remove ? null : price;
            product.DiscountEndDate = request.Remove ? null : request.ExpirationDate!.Value.ToUniversalTime();
        }
        await db.SaveChangesAsync();
        return NoContent();
    }
}

public class CreateTagRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    public string Name { get; set; } = "";
}

public class DeleteTagsRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    public List<int> Ids { get; set; } = [];
}

public class ProductStatusRequest
{
    public List<int> Ids { get; set; } = [];
    public bool Deleted { get; set; }
}

public class ImportImageRequest
{
    [System.ComponentModel.DataAnnotations.Required] public string Url { get; set; } = "";
}

public class SaveCouponRequest
{
    public bool Cumulative { get; set; }
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.MaxLength(50)]
    public string Code { get; set; } = "";
    [System.ComponentModel.DataAnnotations.Range(1, 99)] public decimal Discount { get; set; }
    public DateTime? ExpirationDate { get; set; }
    public string? ProductType { get; set; }
    public List<int> TagIds { get; set; } = [];
    public bool IsActive { get; set; } = true;
}

public class ProductOffersRequest
{
    public List<int> Ids { get; set; } = [];
    public decimal Discount { get; set; }
    public DateTime? ExpirationDate { get; set; }
    public bool Remove { get; set; }
}
