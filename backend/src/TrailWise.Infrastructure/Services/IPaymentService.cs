using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Services;

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

    public static PaymentStatusResult Success(Guid bookingId, decimal totalCost, decimal totalPaid, decimal remainingAmount, string status) => new()
    {
        Succeeded = true,
        BookingId = bookingId,
        TotalCost = totalCost,
        TotalPaid = totalPaid,
        RemainingAmount = remainingAmount,
        Status = status,
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
}
