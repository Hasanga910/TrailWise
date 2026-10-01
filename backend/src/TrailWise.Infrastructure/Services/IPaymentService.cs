using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Services;

public record PricingBreakdownResult(
    decimal BaseCost,
    decimal CateringCost,
    decimal AddOnCost,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal FinalTotal,
    string? DiscountDescription = null,
    decimal? DiscountPercentage = null);

public class SubmitBankTransferResult
{
    public bool Succeeded { get; init; }
    public string? Error { get; init; }
    public int StatusCode { get; init; }
    public Payment? Payment { get; init; }

    public static SubmitBankTransferResult Success(Payment payment) => new()
    {
        Succeeded = true,
        Payment = payment,
        StatusCode = 201
    };

    public static SubmitBankTransferResult Failure(string error, int statusCode = 400) => new()
    {
        Succeeded = false,
        Error = error,
        StatusCode = statusCode
    };
}

public class PaymentDetailResult
{
    public bool Succeeded { get; init; }
    public string? Error { get; init; }
    public int StatusCode { get; init; }
    public Payment? Payment { get; init; }

    public static PaymentDetailResult Success(Payment payment) => new()
    {
        Succeeded = true,
        Payment = payment,
        StatusCode = 200
    };

    public static PaymentDetailResult Failure(string error, int statusCode = 400) => new()
    {
        Succeeded = false,
        Error = error,
        StatusCode = statusCode
    };
}

public class ApprovePaymentResult
{
    public bool Succeeded { get; init; }
    public string? Error { get; init; }
    public int StatusCode { get; init; }
    public Payment? Payment { get; init; }

    public static ApprovePaymentResult Success(Payment payment) => new()
    {
        Succeeded = true,
        Payment = payment,
        StatusCode = 200
    };

    public static ApprovePaymentResult Failure(string error, int statusCode = 400) => new()
    {
        Succeeded = false,
        Error = error,
        StatusCode = statusCode
    };
}

public class RejectPaymentResult
{
    public bool Succeeded { get; init; }
    public string? Error { get; init; }
    public int StatusCode { get; init; }
    public Payment? Payment { get; init; }

    public static RejectPaymentResult Success(Payment payment) => new()
    {
        Succeeded = true,
        Payment = payment,
        StatusCode = 200
    };

    public static RejectPaymentResult Failure(string error, int statusCode = 400) => new()
    {
        Succeeded = false,
        Error = error,
        StatusCode = statusCode
    };
}

public class RecordPaymentResult
{
    public bool Succeeded { get; init; }
    public string? Error { get; init; }
    public int StatusCode { get; init; }
    public Payment? Payment { get; init; }

    public static RecordPaymentResult Success(Payment payment) => new()
    {
        Succeeded = true,
        Payment = payment,
        StatusCode = 201
    };

    public static RecordPaymentResult Failure(string error, int statusCode = 400) => new()
    {
        Succeeded = false,
        Error = error,
        StatusCode = statusCode
    };
}

public class PaymentStatusResult
{
    public bool Succeeded { get; init; }
    public string? Error { get; init; }
    public int StatusCode { get; init; }
    public Guid BookingId { get; init; }
    public decimal TotalCost { get; init; }
    public decimal TotalPaid { get; init; }
    public decimal RemainingAmount { get; init; }
    public string Status { get; init; } = string.Empty;
    public bool HasPendingVerification { get; init; }
    public decimal? MinimumAdvance { get; init; }
    public string? LatestRejectedPaymentReason { get; init; }
    public DateTimeOffset? LatestRejectedAt { get; init; }
    public Guid? LatestRejectedPaymentId { get; init; }
    public DateTimeOffset? PaymentDueAt { get; init; }
    public bool IsPaymentDeadlineExpired { get; init; }
    public DateTimeOffset? BalancePaymentDueAt { get; init; }
    public bool IsBalancePaymentDeadlineExpired { get; init; }
    public string BookingStatus { get; init; } = string.Empty;
    public PricingBreakdownResult? PricingBreakdown { get; init; }

    public static PaymentStatusResult Success(
        Guid bookingId,
        decimal totalCost,
        decimal totalPaid,
        decimal remainingAmount,
        string status,
        bool hasPendingVerification = false,
        decimal? minimumAdvance = null,
        string? latestRejectedPaymentReason = null,
        DateTimeOffset? latestRejectedAt = null,
        Guid? latestRejectedPaymentId = null,
        DateTimeOffset? paymentDueAt = null,
        bool isPaymentDeadlineExpired = false,
        DateTimeOffset? balancePaymentDueAt = null,
        bool isBalancePaymentDeadlineExpired = false,
        string bookingStatus = "",
        PricingBreakdownResult? pricingBreakdown = null) => new()
    {
        Succeeded = true,
        BookingId = bookingId,
        TotalCost = totalCost,
        TotalPaid = totalPaid,
        RemainingAmount = remainingAmount,
        Status = status,
        HasPendingVerification = hasPendingVerification,
        MinimumAdvance = minimumAdvance,
        LatestRejectedPaymentReason = latestRejectedPaymentReason,
        LatestRejectedAt = latestRejectedAt,
        LatestRejectedPaymentId = latestRejectedPaymentId,
        PaymentDueAt = paymentDueAt,
        IsPaymentDeadlineExpired = isPaymentDeadlineExpired,
        BalancePaymentDueAt = balancePaymentDueAt,
        IsBalancePaymentDeadlineExpired = isBalancePaymentDeadlineExpired,
        BookingStatus = bookingStatus,
        PricingBreakdown = pricingBreakdown,
        StatusCode = 200
    };

    public static PaymentStatusResult Failure(string error, int statusCode = 400) => new()
    {
        Succeeded = false,
        Error = error,
        StatusCode = statusCode
    };
}

public interface IPaymentService
{
    Task<SubmitBankTransferResult> SubmitBankTransferAsync(
        Guid bookingId,
        decimal amount,
        string bankSlipUrl,
        Guid travelerId,
        CancellationToken ct = default);

    Task<IReadOnlyList<Payment>> GetPendingPaymentsAsync(CancellationToken ct = default);

    Task<PaymentDetailResult> GetPaymentByIdAsync(
        Guid paymentId,
        Guid requestingUserId,
        bool isManagerOrAdmin,
        CancellationToken ct = default);

    Task<ApprovePaymentResult> ApprovePaymentAsync(
        Guid paymentId,
        Guid staffUserId,
        CancellationToken ct = default);

    Task<RejectPaymentResult> RejectPaymentAsync(
        Guid paymentId,
        string reason,
        Guid staffUserId,
        CancellationToken ct = default);

    Task<RecordPaymentResult> RecordPaymentAsync(
        Guid bookingId,
        decimal amount,
        string method,
        Guid travelerId,
        CancellationToken ct = default);

    Task<PaymentStatusResult> GetPaymentStatusAsync(
        Guid bookingId,
        Guid requestingUserId,
        bool isManagerOrAdmin,
        CancellationToken ct = default);

    Task<Dictionary<Guid, PaymentStatusResult>> GetPaymentStatusesForBookingsAsync(
        IEnumerable<Guid> bookingIds,
        Guid requestingUserId,
        bool isManagerOrAdmin,
        CancellationToken ct = default);
}
