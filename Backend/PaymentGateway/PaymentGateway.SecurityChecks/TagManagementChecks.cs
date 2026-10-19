using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PaymentGateway.API.Controllers;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Domain.Entities;
using PaymentGateway.Infrastructure.Persistence;

internal static class TagManagementChecks
{
    public static async Task RunAsync(DbContextOptions<PaymentDbContext> options, Action<bool, string> check)
    {
        await using var db = new PaymentDbContext(options);
        var custom = new Tag { Name = "Tagprueba" };
        var keep = new Tag { Name = "Conservar" };
        db.Tags.AddRange(custom, keep); await db.SaveChangesAsync();
        var automatic = await db.Tags.Where(tag => tag.NormalizedName == "FISICO" || tag.NormalizedName == "DIGITAL").ToListAsync();
        check(automatic.Count == 2, "automatic format tags exist before tag deletion");
        var current = new Product { ProductName = "Tag current", Type = "PHYSICAL", UnitPrice = 123, Stock = 7,
            Tags = "[\"Tagprueba\",\"Físico\",\"Conservar\"]" };
        var deleted = new Product { ProductName = "Tag deleted", Type = "DIGITAL", UnitPrice = 55, IsDeleted = true,
            Tags = "[\"Tágprueba\",\"Digital\",\"Conservar\"]" };
        var coupon = new Coupon { Code = "TAG-SCOPE", Discount = 10, Tags = "[\"Tagprueba\"]" };
        db.AddRange(current, deleted, coupon); await db.SaveChangesAsync();
        var controller = new AdminController(db, null!);
        check(await controller.DeleteTags(new DeleteTagsRequest()) is BadRequestObjectResult, "empty tag deletion is rejected");
        check(await controller.DeleteTags(new DeleteTagsRequest { Ids = [custom.IdTag, automatic[0].IdTag] }) is BadRequestObjectResult &&
            await db.Tags.AnyAsync(tag => tag.IdTag == custom.IdTag), "automatic tags cannot be deleted even in a mixed selection");
        check(await controller.DeleteTags(new DeleteTagsRequest { Ids = [custom.IdTag] }) is OkObjectResult,
            "selected custom tags can be deleted");
        check(!await db.Tags.AnyAsync(tag => tag.IdTag == custom.IdTag) && await db.Tags.AnyAsync(tag => tag.IdTag == keep.IdTag),
            "tag deletion removes only selected registry entries");
        await db.Entry(current).ReloadAsync(); await db.Entry(deleted).ReloadAsync();
        var currentTags = JsonSerializer.Deserialize<List<string>>(current.Tags!)!;
        var deletedTags = JsonSerializer.Deserialize<List<string>>(deleted.Tags!)!;
        check(currentTags.SequenceEqual(new[] { "Físico", "Conservar" }) && deletedTags.SequenceEqual(new[] { "Digital", "Conservar" }),
            "deleted tag is removed from current and deleted products using normalized accent-insensitive comparison");
        check(current.Stock == 7 && current.UnitPrice == 123 && deleted.IsDeleted &&
            await db.Tags.CountAsync(tag => tag.NormalizedName == "FISICO" || tag.NormalizedName == "DIGITAL") == 2,
            "tag deletion preserves format tags, product prices, stock and deleted status");
        check((await db.Coupons.AsNoTracking().SingleAsync(c => c.IdCoupon == coupon.IdCoupon)).Tags == "[\"Tagprueba\"]",
            "deleting a tag does not silently broaden coupon scope");
        check(await controller.Create(new SaveProductRequest { ProductName = "Deleted tag selection", Type = "PHYSICAL", UnitPrice = 100,
            Stock = 1, TagIds = [custom.IdTag] }) is BadRequestObjectResult, "product cannot be saved with a deleted tag");
        check(await controller.Create(new SaveProductRequest { ProductName = "Remaining tag selection", Type = "PHYSICAL", UnitPrice = 100,
            Stock = 1, TagIds = [keep.IdTag] }) is OkObjectResult, "product creation still works with remaining tags and automatic format tag");
    }
}
