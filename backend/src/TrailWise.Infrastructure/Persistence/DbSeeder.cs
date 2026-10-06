using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Options;

namespace TrailWise.Infrastructure.Persistence;

public static class DbSeeder
{
    public static async Task SeedAsync(
        TrailWiseDbContext db,
        IOptions<AdminSeedOptions> adminOptions,
        CancellationToken ct = default,
        ILogger? logger = null)
    {
        if (db.Database.IsRelational())
        {
            await db.Database.MigrateAsync(ct);
            // Ensure schema updates that were added without an EF migration are applied safely
            try
            {
                await db.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE \"Drivers\" ADD COLUMN IF NOT EXISTS \"UserId\" uuid REFERENCES \"Users\"(\"Id\"); " +
                    "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Drivers_UserId\" ON \"Drivers\" (\"UserId\") WHERE \"UserId\" IS NOT NULL;",
                    ct);
            }
            catch
            {
                // Ignore if already applied or not supported
            }
        }
        else
        {
            await db.Database.EnsureCreatedAsync(ct);
        }

        await BackfillApprovalRequestsAsync(db, ct);

        // The only seeded record: the first Admin, created from the AdminSeed options when no Admin exists yet.
        var admin = adminOptions.Value;
        if (!string.IsNullOrWhiteSpace(admin.Email) && !string.IsNullOrWhiteSpace(admin.Password)
            && !await db.Users.AnyAsync(u => u.Role == UserRole.Admin, ct))
        {
            var normalizedEmail = admin.Email.Trim().ToLowerInvariant();
            var hasher = new PasswordHasher<User>();
            var adminUser = new User
            {
                Name = admin.Name,
                Email = normalizedEmail,
                ContactNumber = admin.ContactNumber,
                Role = UserRole.Admin
            };
            adminUser.PasswordHash = hasher.HashPassword(adminUser, admin.Password);
            db.Users.Add(adminUser);
            await db.SaveChangesAsync(ct);
        }

        // Driver records that predate Driver.UserId: link to the matching Driver account, but only
        // when the contact number identifies exactly one driver and one account (never by name).
        await DriverAccountLinker.LinkUnambiguousAsync(db, logger, ct);
    }

    /// <summary>
    /// Bookings that were already waiting in PendingApproval before approval requests existed get an
    /// open request, so they show up in the approvals queue. Idempotent.
    /// </summary>
    private static async Task BackfillApprovalRequestsAsync(TrailWiseDbContext db, CancellationToken ct)
    {
        var orphans = await db.Bookings
            .Where(b => b.Status == BookingStatus.PendingApproval
                && !db.ApprovalRequests.Any(a => a.BookingId == b.Id && a.Status == ApprovalStatus.Pending))
            .ToListAsync(ct);
        if (orphans.Count == 0)
        {
            return;
        }

        foreach (var booking in orphans)
        {
            db.ApprovalRequests.Add(new ApprovalRequest
            {
                BookingId = booking.Id,
                Type = Agents.BookingApprovalEvaluator.ClassifyApprovalType(booking.GroupSize),
                Status = ApprovalStatus.Pending,
                PreviousBookingStatus = BookingStatus.Requested,
                RequestedAt = booking.UpdatedAt,
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
