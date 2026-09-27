using TrailWise.Domain.Entities;

namespace TrailWise.Api.Contracts.Payments;

public record PaymentDto(
    Guid Id,
    Guid BookingId,
    decimal Amount,
    string Method,
    DateTimeOffset? PaidAt,
    string Status,
    DateTimeOffset CreatedAt)
{
    public static PaymentDto FromEntity(Payment payment) => new(
        payment.Id,
        payment.BookingId,
        payment.Amount,
        payment.Method,
        payment.PaidAt,
        payment.Status.ToString(),
        payment.CreatedAt);
}
