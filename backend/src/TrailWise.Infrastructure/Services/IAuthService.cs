using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;

namespace TrailWise.Infrastructure.Services;

public interface IAuthService
{
    Task<AuthResult> RegisterTravelerAsync(string name, string email, string password, CancellationToken ct = default);
    Task<AuthResult> LoginAsync(string email, string password, CancellationToken ct = default);
    Task<AuthResult> CreateUserAsync(string name, string email, string password, UserRole role, CancellationToken ct = default);
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<User>> GetStaffAsync(CancellationToken ct = default);
    Task<AuthResult> DeleteUserAsync(Guid id, Guid requestedById, CancellationToken ct = default);
    Task<AuthResult> UpdateProfileAsync(Guid userId, string name, string email, CancellationToken ct = default);
    Task<AuthResult> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken ct = default);
}
