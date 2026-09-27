using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrailWise.Api.Contracts.Common;
using TrailWise.Api.Contracts.Payments;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

[ApiController]
[Authorize]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentService _paymentService;

    public PaymentsController(IPaymentService paymentService)
    {
        _paymentService = paymentService;
    }

    [HttpPost("api/payments")]
    public async Task<ActionResult<PaymentDto>> CreatePayment([FromBody] CreatePaymentRequest request, CancellationToken ct)
    {
        var travelerId = GetUserId();
        if (travelerId is null)
        {
            return Unauthorized();
        }

        if (request.Amount <= 0)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("amount", "Payment amount must be greater than 0.") }
            });
        }

        if (!string.Equals(request.Method, "Card", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(request.Method, "BankTransfer", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("method", "Payment method must be 'Card' or 'BankTransfer'.") }
            });
        }

        var result = await _paymentService.RecordPaymentAsync(
            request.BookingId,
            request.Amount,
            request.Method,
            travelerId.Value,
            ct);

        if (!result.Succeeded)
        {
            return result.StatusCode switch
            {
                StatusCodes.Status404NotFound => Problem(statusCode: StatusCodes.Status404NotFound, title: result.Error),
                StatusCodes.Status403Forbidden => Forbid(),
                StatusCodes.Status409Conflict => Problem(statusCode: StatusCodes.Status409Conflict, title: result.Error),
                _ => BadRequest(new { message = result.Error })
            };
        }

        var dto = PaymentDto.FromEntity(result.Payment!);
        return CreatedAtAction(nameof(GetPaymentStatus), new { id = request.BookingId }, dto);
    }

    [HttpGet("api/bookings/{id:guid}/payment-status")]
    public async Task<ActionResult<PaymentStatusDto>> GetPaymentStatus(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var isManagerOrAdmin = User.IsInRole("Admin") || User.IsInRole("OperationsManager");

        var result = await _paymentService.GetPaymentStatusAsync(id, userId.Value, isManagerOrAdmin, ct);

        if (!result.Succeeded)
        {
            return result.StatusCode switch
            {
                StatusCodes.Status404NotFound => Problem(statusCode: StatusCodes.Status404NotFound, title: result.Error),
                StatusCodes.Status403Forbidden => Forbid(),
                _ => BadRequest(new { message = result.Error })
            };
        }

        return Ok(new PaymentStatusDto(
            result.BookingId,
            result.TotalCost,
            result.TotalPaid,
            result.RemainingAmount,
            result.Status));
    }

    private Guid? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out var id) ? id : null;
    }
}
