using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Auth;

public record UserDto(Guid Id, string Name, string Email, string ContactNumber, UserRole Role)
{
    public static UserDto FromEntity(User user) => new(user.Id, user.Name, user.Email, user.ContactNumber, user.Role);
}
