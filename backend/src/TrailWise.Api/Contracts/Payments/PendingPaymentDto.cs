namespace TrailWise.Api.Contracts.Payments;

public record PendingPaymentDto(
    Guid Id,
    Guid BookingId,
    string? TravelerName,
    string? TravelerEmail,
    string? PackageName,
    decimal Amount,
    string BankSlipUrl,
    DateTimeOffset SubmittedAt,
    string Status,
    DateTimeOffset? PaymentDueAt = null,
    DateTimeOffset? BalancePaymentDueAt = null);
