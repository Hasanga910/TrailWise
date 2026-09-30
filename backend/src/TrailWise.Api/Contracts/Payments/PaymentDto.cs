namespace TrailWise.Api.Contracts.Payments;

public record PaymentDto(
    Guid Id,
    Guid BookingId,
    decimal Amount,
    string Method,
    string BankSlipUrl,
    DateTimeOffset SubmittedAt,
    DateTimeOffset? PaidAt,
    string Status,
    DateTimeOffset? ReviewedAt,
    Guid? ReviewedBy,
    string? RejectionReason,
    DateTimeOffset CreatedAt)
{
    public static PaymentDto FromEntity(Domain.Entities.Payment payment) => new(
        payment.Id,
        payment.BookingId,
        payment.Amount,
        payment.Method,
        payment.BankSlipUrl,
        payment.SubmittedAt,
        payment.PaidAt,
        payment.Status.ToString(),
        payment.ReviewedAt,
        payment.ReviewedBy,
        payment.RejectionReason,
        payment.CreatedAt);
}
