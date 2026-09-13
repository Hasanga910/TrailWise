using Microsoft.EntityFrameworkCore;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence;

public class TrailWiseDbContext : DbContext
{
    public TrailWiseDbContext(DbContextOptions<TrailWiseDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<TourPackage> TourPackages => Set<TourPackage>();
    public DbSet<PackageTier> PackageTiers => Set<PackageTier>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<BookingAddOn> BookingAddOns => Set<BookingAddOn>();
    public DbSet<Guide> Guides => Set<Guide>();
    public DbSet<GuideAvailability> GuideAvailabilities => Set<GuideAvailability>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<Driver> Drivers => Set<Driver>();
    public DbSet<VehicleAssignment> VehicleAssignments => Set<VehicleAssignment>();
    public DbSet<ItineraryStep> ItinerarySteps => Set<ItineraryStep>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<AgentWorkflowRun> AgentWorkflowRuns => Set<AgentWorkflowRun>();
    public DbSet<AgentStepLog> AgentStepLogs => Set<AgentStepLog>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TrailWiseDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }

    public override int SaveChanges()
    {
        TouchTimestamps();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TouchTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void TouchTimestamps()
    {
        foreach (var entry in ChangeTracker.Entries<Domain.Entities.BaseEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = DateTimeOffset.UtcNow;
                entry.Entity.UpdatedAt = DateTimeOffset.UtcNow;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }
    }
}
