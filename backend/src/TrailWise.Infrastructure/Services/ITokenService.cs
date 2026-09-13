using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Services;

public interface ITokenService
{
    string CreateToken(User user);
}
