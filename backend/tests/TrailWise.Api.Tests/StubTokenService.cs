using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Tests;

internal class StubTokenService : ITokenService
{
    public string CreateToken(User user) => $"stub-token-for-{user.Id}";
}
