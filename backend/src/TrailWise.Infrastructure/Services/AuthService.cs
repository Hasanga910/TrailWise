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

    public async Task<AuthResult> RegisterTravelerAsync(string name, string email, string password, string contactNumber, CancellationToken ct = default)
    {
        return await CreateUserAsync(name, email, password, contactNumber, UserRole.Traveler, ct);
    }

    public async Task<AuthResult> CreateUserAsync(string name, string email, string password, string contactNumber, UserRole role, CancellationToken ct = default)
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
            ContactNumber = contactNumber.Trim(),
            Role = role
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, password);

        if (role == UserRole.TourGuide)
        {
            var guide = new Guide
            {
                UserId = user.Id,
                Name = user.Name,
                ContactInfo = user.ContactNumber,
                Languages = Array.Empty<string>(),
                Specializations = Array.Empty<string>()
            };

            await using var transaction = _db.Database.IsRelational()
                ? await _db.Database.BeginTransactionAsync(ct)
                : null;

            try
            {
                _db.Users.Add(user);
                _db.Guides.Add(guide);
                await _db.SaveChangesAsync(ct);

                if (transaction is not null)
                {
                    await transaction.CommitAsync(ct);
                }
            }
            catch
            {
                if (transaction is not null)
                {
                    await transaction.RollbackAsync(ct);
                }
                throw;
            }
        }
        else if (role == UserRole.Driver)
        {
            // If an unlinked Driver profile already exists matching name or contact number or license, link it;
            // otherwise, create a new Driver record linked to this user.
            var existingDriver = await _db.Drivers
                .FirstOrDefaultAsync(d => d.UserId == null && (
                    (!string.IsNullOrEmpty(user.ContactNumber) && d.ContactInfo == user.ContactNumber) ||
                    (!string.IsNullOrEmpty(user.Name) && d.Name.ToLower() == user.Name.ToLower())
                ), ct);

            await using var transaction = _db.Database.IsRelational()
                ? await _db.Database.BeginTransactionAsync(ct)
                : null;

            try
            {
                _db.Users.Add(user);

                if (existingDriver != null)
                {
                    existingDriver.UserId = user.Id;
                    if (string.IsNullOrWhiteSpace(existingDriver.ContactInfo) && !string.IsNullOrWhiteSpace(user.ContactNumber))
                    {
                        existingDriver.ContactInfo = user.ContactNumber;
                    }
                }
                else
                {
                    var driver = new Driver
                    {
                        UserId = user.Id,
                        Name = user.Name,
                        ContactInfo = user.ContactNumber,
                        LicenseNumber = $"LIC-{user.Id.ToString("N")[..8].ToUpperInvariant()}"
                    };
                    _db.Drivers.Add(driver);
                }

                await _db.SaveChangesAsync(ct);

                if (transaction is not null)
                {
                    await transaction.CommitAsync(ct);
                }
            }
            catch
            {
                if (transaction is not null)
                {
                    await transaction.RollbackAsync(ct);
                }
                throw;
            }
        }
        else
        {
            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct);
        }

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

    public async Task<IReadOnlyList<User>> GetStaffAsync(CancellationToken ct = default)
    {
        return await _db.Users
            .Where(u => u.Role != UserRole.Traveler)
            .OrderBy(u => u.Name)
            .ToListAsync(ct);
    }

    public async Task<AuthResult> DeleteUserAsync(Guid id, Guid requestedById, CancellationToken ct = default)
    {
        if (id == requestedById)
        {
            return AuthResult.Failure("You cannot delete your own account.");
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null)
        {
            return AuthResult.Failure("User not found.");
        }

        if (user.Role == UserRole.Traveler)
        {
            return AuthResult.Failure("Only staff accounts can be removed here.");
        }

        _db.Users.Remove(user);
        await _db.SaveChangesAsync(ct);

        return AuthResult.Ok();
    }

    public async Task<AuthResult> DeleteSelfAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            return AuthResult.Failure("User not found.");
        }

        if (user.Role == UserRole.Admin)
        {
            var adminCount = await _db.Users.CountAsync(u => u.Role == UserRole.Admin, ct);
            if (adminCount <= 1)
            {
                return AuthResult.Failure("Cannot delete the only administrator account.");
            }
        }

        if (user.Role == UserRole.TourGuide)
        {
            var guide = await _db.Guides.FirstOrDefaultAsync(g => g.UserId == userId, ct);
            if (guide != null)
            {
                var hasAssignedTours = await _db.Bookings.AnyAsync(b => b.GuideAvailabilities.Any(g => g.GuideId == guide.Id), ct)
                    || await _db.GuideAvailabilities.AnyAsync(g => g.GuideId == guide.Id && g.AssignedBookingId != null, ct);
                if (hasAssignedTours)
                {
                    return AuthResult.Failure("Guide profile cannot be deleted while assigned tours exist.");
                }

                var availabilities = await _db.GuideAvailabilities
                    .Where(a => a.GuideId == guide.Id)
                    .ToListAsync(ct);
                if (availabilities.Count > 0)
                {
                    _db.GuideAvailabilities.RemoveRange(availabilities);
                }

                _db.Guides.Remove(guide);
            }
        }

        // If user is linked to a driver profile, clean up or unlink
        var driver = await _db.Drivers.FirstOrDefaultAsync(d => d.UserId == userId, ct);
        if (driver is not null)
        {
            driver.UserId = null;
        }

        _db.Users.Remove(user);
        await _db.SaveChangesAsync(ct);

        return AuthResult.Ok();
    }

    public async Task<AuthResult> UpdateProfileAsync(Guid userId, string name, string email, string contactNumber, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            return AuthResult.Failure("User not found.");
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var emailTaken = await _db.Users.AnyAsync(u => u.Id != userId && u.Email == normalizedEmail, ct);
        if (emailTaken)
        {
            return AuthResult.Failure("A user with this email already exists.");
        }

        user.Name = name.Trim();
        user.Email = normalizedEmail;
        user.ContactNumber = contactNumber.Trim();

        if (user.Role == UserRole.TourGuide)
        {
            var guide = await _db.Guides.FirstOrDefaultAsync(g => g.UserId == userId, ct);
            if (guide is not null)
            {
                guide.Name = user.Name;
                guide.ContactInfo = user.ContactNumber;
            }
        }

        // If driver, sync driver profile details
        if (user.Role == UserRole.Driver)
        {
            var driver = await _db.Drivers.FirstOrDefaultAsync(d => d.UserId == userId, ct);
            if (driver is not null)
            {
                driver.Name = user.Name;
                driver.ContactInfo = user.ContactNumber;
            }
        }

        await _db.SaveChangesAsync(ct);

        return AuthResult.Success(user);
    }

    public async Task<AuthResult> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            return AuthResult.Failure("User not found.");
        }

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, currentPassword);
        if (verification == PasswordVerificationResult.Failed)
        {
            return AuthResult.Failure("Current password is incorrect.");
        }

        user.PasswordHash = _passwordHasher.HashPassword(user, newPassword);
        await _db.SaveChangesAsync(ct);

        return AuthResult.Ok();
    }
}
