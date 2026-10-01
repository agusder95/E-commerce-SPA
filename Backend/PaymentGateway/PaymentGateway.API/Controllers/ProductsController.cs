using Microsoft.AspNetCore.Mvc;
using PaymentGateway.Application.DTOs;
using PaymentGateway.Application.Interfaces;

namespace PaymentGateway.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly IProductRepository _productRepository;

    public ProductsController(IProductRepository productRepository)
    {
        _productRepository = productRepository;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var products = await _productRepository.GetAllActiveAsync();
        var response = products.Select(ProductResponseDTO.FromEntity);
        return Ok(response);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var product = await _productRepository.GetByIdAsync(id);
        if (product == null)
            return NotFound(new { Message = "Producto no encontrado." });

        return Ok(ProductResponseDTO.FromEntity(product));
    }
}
