using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using TrailWise.Api.Contracts.Common;
using TrailWise.Api.Contracts.Payments;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

[ApiController]
[Authorize]
public class PaymentsController : ControllerBase
{
    private const string StaffRoles = "Admin,OperationsManager";

    private readonly IPaymentService _paymentService;
    private readonly IBankSlipStorageService _slipStorageService;

    public PaymentsController(
        IPaymentService paymentService,
        IBankSlipStorageService slipStorageService)
    {
        _paymentService = paymentService;
        _slipStorageService = slipStorageService;
    }

    [HttpPost("api/bookings/{id:guid}/payments/bank-transfer")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(BankSlipStorageService.MaxSlipSizeBytes)]
    public async Task<ActionResult<PaymentDto>> SubmitBankTransfer(
        Guid id,
        [FromForm] SubmitBankTransferRequest request,
        CancellationToken ct)
    {
        var travelerId = GetUserId();
        if (travelerId is null)
        {
            return Unauthorized();
        }

        var slipFile = request.BankSlip ?? Request.Form.Files["bankSlip"] ?? Request.Form.Files.FirstOrDefault();

        if (slipFile is null)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("bankSlip", "Bank slip file is required.") }
            });
        }

        if (!_slipStorageService.ValidateSlip(slipFile.Length, slipFile.FileName, slipFile.ContentType, out var validationError, out _))
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("bankSlip", validationError!) }
            });
        }

        string storageReference;
        await using (var stream = slipFile.OpenReadStream())
        {
            storageReference = await _slipStorageService.SaveSlipAsync(stream, slipFile.FileName, slipFile.ContentType, ct);
        }

        var result = await _paymentService.SubmitBankTransferAsync(
            id,
            request.Amount,
            storageReference,
            travelerId.Value,
            ct);

        if (!result.Succeeded)
        {
            await _slipStorageService.DeleteSlipAsync(storageReference, ct);

            return result.StatusCode switch
            {
                StatusCodes.Status404NotFound => Problem(statusCode: StatusCodes.Status404NotFound, title: result.Error),
                StatusCodes.Status403Forbidden => Forbid(),
                StatusCodes.Status409Conflict => Problem(statusCode: StatusCodes.Status409Conflict, title: result.Error),
                _ => BadRequest(new { message = result.Error })
            };
        }

        var dto = PaymentDto.FromEntity(result.Payment!);
        return CreatedAtAction(nameof(GetPaymentById), new { id = result.Payment!.Id }, dto);
    }

    [HttpGet("api/payments/{id:guid}/slip")]
    public async Task<IActionResult> GetPaymentSlip(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var isStaff = User.IsInRole("Admin") || User.IsInRole("OperationsManager");
        var result = await _paymentService.GetPaymentByIdAsync(id, userId.Value, isStaff, ct);

        if (!result.Succeeded)
        {
            return result.StatusCode switch
            {
                StatusCodes.Status404NotFound => Problem(statusCode: StatusCodes.Status404NotFound, title: result.Error),
                StatusCodes.Status403Forbidden => Forbid(),
                _ => BadRequest(new { message = result.Error })
            };
        }

        var payment = result.Payment!;
        if (string.IsNullOrWhiteSpace(payment.BankSlipUrl))
        {
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Bank slip file not found for this payment.");
        }

        var fileResult = await _slipStorageService.OpenSlipReadStreamAsync(payment.BankSlipUrl, ct);
        if (fileResult is null)
        {
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Bank slip file not found on disk.");
        }

        Response.Headers.ContentDisposition = "inline";
        return File(fileResult.Stream, fileResult.ContentType, enableRangeProcessing: true);
    }

    [HttpGet("api/payments/pending")]
    [Authorize(Roles = StaffRoles)]
    public async Task<ActionResult<IReadOnlyList<PendingPaymentDto>>> GetPendingPayments(CancellationToken ct)
    {
        var payments = await _paymentService.GetPendingPaymentsAsync(ct);

        var dtos = payments.Select(p => new PendingPaymentDto(
            p.Id,
            p.BookingId,
            p.Booking?.Traveler?.Name,
            p.Booking?.Traveler?.Email,
            p.Booking?.TourPackage?.Name,
            p.Amount,
            p.BankSlipUrl,
            p.SubmittedAt,
            p.Status.ToString(),
            p.Booking?.PaymentDueAt,
            p.Booking?.BalancePaymentDueAt)).ToList();

        return Ok(dtos);
    }

    [HttpGet("api/payments/{id:guid}")]
    public async Task<ActionResult<PaymentDto>> GetPaymentById(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var isStaff = User.IsInRole("Admin") || User.IsInRole("OperationsManager");
        var result = await _paymentService.GetPaymentByIdAsync(id, userId.Value, isStaff, ct);

        if (!result.Succeeded)
        {
            return result.StatusCode switch
            {
                StatusCodes.Status404NotFound => Problem(statusCode: StatusCodes.Status404NotFound, title: result.Error),
                StatusCodes.Status403Forbidden => Forbid(),
                _ => BadRequest(new { message = result.Error })
            };
        }

        return Ok(PaymentDto.FromEntity(result.Payment!));
    }

    [HttpPost("api/payments/{id:guid}/approve")]
    [Authorize(Roles = StaffRoles)]
    public async Task<ActionResult<PaymentDto>> ApprovePayment(Guid id, CancellationToken ct)
    {
        var staffId = GetUserId();
        if (staffId is null)
        {
            return Unauthorized();
        }

        var result = await _paymentService.ApprovePaymentAsync(id, staffId.Value, ct);

        if (!result.Succeeded)
        {
            return result.StatusCode switch
            {
                StatusCodes.Status404NotFound => Problem(statusCode: StatusCodes.Status404NotFound, title: result.Error),
                StatusCodes.Status400BadRequest => BadRequest(new { message = result.Error }),
                _ => BadRequest(new { message = result.Error })
            };
        }

        return Ok(PaymentDto.FromEntity(result.Payment!));
    }

    [HttpPost("api/payments/{id:guid}/reject")]
    [Authorize(Roles = StaffRoles)]
    public async Task<ActionResult<PaymentDto>> RejectPayment(
        Guid id,
        [FromBody] RejectPaymentRequest request,
        CancellationToken ct)
    {
        var staffId = GetUserId();
        if (staffId is null)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request?.Reason))
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("reason", "Rejection reason is required.") }
            });
        }

        var result = await _paymentService.RejectPaymentAsync(id, request.Reason, staffId.Value, ct);

        if (!result.Succeeded)
        {
            return result.StatusCode switch
            {
                StatusCodes.Status404NotFound => Problem(statusCode: StatusCodes.Status404NotFound, title: result.Error),
                StatusCodes.Status400BadRequest => BadRequest(new { message = result.Error }),
                _ => BadRequest(new { message = result.Error })
            };
        }

        return Ok(PaymentDto.FromEntity(result.Payment!));
    }

    [HttpGet("api/bookings/{id:guid}/payment-status")]
    public async Task<ActionResult<PaymentStatusDto>> GetPaymentStatus(Guid id, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var isStaff = User.IsInRole("Admin") || User.IsInRole("OperationsManager");
        var result = await _paymentService.GetPaymentStatusAsync(id, userId.Value, isStaff, ct);

        if (!result.Succeeded)
        {
            return result.StatusCode switch
            {
                StatusCodes.Status404NotFound => Problem(statusCode: StatusCodes.Status404NotFound, title: result.Error),
                StatusCodes.Status403Forbidden => Forbid(),
                _ => BadRequest(new { message = result.Error })
            };
        }

        PricingBreakdownDto? pricingBreakdown = result.PricingBreakdown is not null
            ? new PricingBreakdownDto(
                result.PricingBreakdown.BaseCost,
                result.PricingBreakdown.CateringCost,
                result.PricingBreakdown.AddOnCost,
                result.PricingBreakdown.Subtotal,
                result.PricingBreakdown.DiscountAmount,
                result.PricingBreakdown.FinalTotal,
                result.PricingBreakdown.DiscountDescription,
                result.PricingBreakdown.DiscountPercentage)
            : null;

        return Ok(new PaymentStatusDto(
            result.BookingId,
            result.TotalCost,
            result.TotalPaid,
            result.RemainingAmount,
            result.Status,
            result.HasPendingVerification,
            result.MinimumAdvance,
            result.LatestRejectedPaymentReason,
            result.LatestRejectedAt,
            result.LatestRejectedPaymentId,
            result.PaymentDueAt,
            result.IsPaymentDeadlineExpired,
            result.BalancePaymentDueAt,
            result.IsBalancePaymentDeadlineExpired,
            result.BookingStatus,
            pricingBreakdown));
    }

    [HttpPost("api/payments")]
    [Obsolete("Direct payment recording without bank slip is deprecated. Use POST /api/bookings/{id}/payments/bank-transfer.")]
    public async Task<ActionResult<PaymentDto>> CreatePayment([FromBody] CreatePaymentRequest request, CancellationToken ct)
    {
        await Task.CompletedTask;
        var travelerId = GetUserId();
        if (travelerId is null)
        {
            return Unauthorized();
        }

        if (string.Equals(request.Method, "Card", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("method", "Card payments are no longer supported. Please submit a bank transfer slip.") }
            });
        }

        return BadRequest(new
        {
            message = "Direct payment recording is deprecated. Please upload a bank transfer slip to /api/bookings/{id}/payments/bank-transfer."
        });
    }

    private Guid? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out var id) ? id : null;
    }
}
