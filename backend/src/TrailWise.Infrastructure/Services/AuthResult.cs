using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Services;

public class AuthResult
{
    public bool Succeeded { get; init; }
    public string? Error { get; init; }
    public User? User { get; init; }
    public string? Token { get; init; }

    public static AuthResult Success(User user, string token) => new()
    {
        Succeeded = true,
        User = user,
        Token = token
    };

    public static AuthResult Failure(string error) => new()
    {
        Succeeded = false,
        Error = error
    };
}
