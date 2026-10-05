using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Enums;

namespace TrailWise.Infrastructure.Persistence;

/// <summary>
/// One-time (idempotent) startup fix that links a driver record to the Driver account that was
/// created for the same person, for data that predates Driver.UserId. A driver's trips, including
/// travelers' names and phone numbers, are only ever served through that link, so a wrong link
/// would leak personal data: it is made only when the match is unambiguous.
/// </summary>
public static class DriverAccountLinker
{
    /// <summary>
    /// Links a driver to a Driver-role user when exactly one driver record and exactly one Driver
    /// account carry the same contact number (exact match after trimming; never by name), both
    /// counted across linked and unlinked rows, and neither is linked yet. Anything ambiguous or
    /// already linked is left alone. Contact numbers are personal data and are not logged: only ids.
    /// </summary>
    /// <returns>The number of links made.</returns>
    public static async Task<int> LinkUnambiguousAsync(
        TrailWiseDbContext db, ILogger? logger = null, CancellationToken ct = default)
    {
        var drivers = await db.Drivers.ToListAsync(ct);
        if (!drivers.Any(d => d.UserId is null && !string.IsNullOrWhiteSpace(d.ContactInfo)))
        {
            return 0;
        }

        var driverUsers = await db.Users
            .AsNoTracking()
            .Where(u => u.Role == UserRole.Driver)
            .Select(u => new { u.Id, u.ContactNumber })
            .ToListAsync(ct);
        var linkedUserIds = drivers.Where(d => d.UserId is not null).Select(d => d.UserId!.Value).ToHashSet();

        var linked = 0;
        var phones = drivers
            .Where(d => d.UserId is null && !string.IsNullOrWhiteSpace(d.ContactInfo))
            .Select(d => d.ContactInfo.Trim())
            .Distinct(StringComparer.Ordinal);

        foreach (var phone in phones)
        {
            var driversWithPhone = drivers.Where(d => d.ContactInfo.Trim() == phone).ToList();
            var usersWithPhone = driverUsers
                .Where(u => !string.IsNullOrWhiteSpace(u.ContactNumber) && u.ContactNumber.Trim() == phone)
                .ToList();

            if (usersWithPhone.Count == 0)
            {
                continue; // a driver without a login account: nothing to link
            }

            if (driversWithPhone.Count != 1 || usersWithPhone.Count != 1)
            {
                logger?.LogWarning(
                    "Not linking driver records [{DriverIds}] to Driver accounts [{UserIds}]: they share a contact number, so the match is ambiguous.",
                    string.Join(", ", driversWithPhone.Select(d => d.Id)),
                    string.Join(", ", usersWithPhone.Select(u => u.Id)));
                continue;
            }

            var driver = driversWithPhone[0];
            var user = usersWithPhone[0];
            if (driver.UserId is not null || linkedUserIds.Contains(user.Id))
            {
                continue; // one side is already linked (possibly to someone else): never re-point
            }

            driver.UserId = user.Id;
            linkedUserIds.Add(user.Id);
            linked++;
            logger?.LogInformation(
                "Linked driver {DriverId} to user {UserId} by unambiguous contact number.", driver.Id, user.Id);
        }

        if (linked > 0)
        {
            await db.SaveChangesAsync(ct);
        }

        return linked;
    }
}
