using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Support;

public record SupportMessageDto(
    Guid Id,
    Guid SenderId,
    string SenderDisplayName,
    bool IsStaff,
    string Message,
    DateTimeOffset CreatedAt)
{
    public static SupportMessageDto FromEntity(SupportMessage msg)
    {
        var isStaff = msg.Sender != null && (msg.Sender.Role is UserRole.Admin or UserRole.OperationsManager);
        var displayName = isStaff ? "TrailWise Support" : (msg.Sender?.Name ?? "Traveler");

        return new(
            msg.Id,
            msg.SenderId,
            displayName,
            isStaff,
            msg.Message,
            msg.CreatedAt);
    }
}
