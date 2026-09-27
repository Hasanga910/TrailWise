namespace TrailWise.Api.Contracts.Payments;

public record PaymentStatusDto(
    Guid BookingId,
    decimal TotalCost,
    decimal TotalPaid,
    decimal RemainingAmount,
    string Status);
