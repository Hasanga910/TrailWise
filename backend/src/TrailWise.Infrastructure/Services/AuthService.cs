using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly TrailWiseDbContext _db;
    private readonly ITokenService _tokenService;
    private readonly PasswordHasher<User> _passwordHasher = new();

    public AuthService(TrailWiseDbContext db, ITokenService tokenService)
    {
        _db = db;
        _tokenService = tokenService;
    }

    public async Task<AuthResult> RegisterTravelerAsync(string name, string email, string password, CancellationToken ct = default)
    {
        return await CreateUserAsync(name, email, password, UserRole.Traveler, ct);
    }

    public async Task<AuthResult> CreateUserAsync(string name, string email, string password, UserRole role, CancellationToken ct = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();

        var exists = await _db.Users.AnyAsync(u => u.Email == normalizedEmail, ct);
        if (exists)
        {
            return AuthResult.Failure("A user with this email already exists.");
        }

        var user = new User
        {
            Name = name.Trim(),
            Email = normalizedEmail,
            Role = role
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, password);

        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        var token = _tokenService.CreateToken(user);
        return AuthResult.Success(user, token);
    }

    public async Task<AuthResult> LoginAsync(string email, string password, CancellationToken ct = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, ct);
        if (user is null)
        {
            return AuthResult.Failure("Invalid email or password.");
        }

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (verification == PasswordVerificationResult.Failed)
        {
            return AuthResult.Failure("Invalid email or password.");
        }

        var token = _tokenService.CreateToken(user);
        return AuthResult.Success(user, token);
    }

    public Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
    }
}
