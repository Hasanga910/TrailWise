using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Support;

public record UpdateSupportStatusRequest(TicketStatus Status);
