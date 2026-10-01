namespace TrailWise.Api.Contracts.Payments;

public record PaymentStatusDto(
    Guid BookingId,
    decimal TotalCost,
    decimal TotalPaid,
    decimal RemainingAmount,
    string Status,
    bool HasPendingVerification = false,
    decimal? MinimumAdvance = null,
    string? LatestRejectedPaymentReason = null,
    DateTimeOffset? LatestRejectedAt = null,
    Guid? LatestRejectedPaymentId = null,
    DateTimeOffset? PaymentDueAt = null,
    bool IsPaymentDeadlineExpired = false,
    DateTimeOffset? BalancePaymentDueAt = null,
    bool IsBalancePaymentDeadlineExpired = false,
    string? BookingStatus = null,
    PricingBreakdownDto? PricingBreakdown = null);
