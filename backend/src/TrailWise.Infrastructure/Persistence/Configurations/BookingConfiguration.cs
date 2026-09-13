using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class BookingConfiguration : IEntityTypeConfiguration<Booking>
{
    public void Configure(EntityTypeBuilder<Booking> builder)
    {
        builder.Property(b => b.Status).HasConversion<string>().HasMaxLength(32);
        builder.Property(b => b.BudgetPerPerson).HasPrecision(10, 2);

        builder.HasOne(b => b.Traveler)
            .WithMany(u => u.Bookings)
            .HasForeignKey(b => b.TravelerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(b => b.Status);
        builder.HasIndex(b => b.TravelerId);

        builder.HasMany(b => b.BookingAddOns)
            .WithOne(a => a.Booking)
            .HasForeignKey(a => a.BookingId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(b => b.ItinerarySteps)
            .WithOne(i => i.Booking)
            .HasForeignKey(i => i.BookingId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(b => b.Payments)
            .WithOne(p => p.Booking)
            .HasForeignKey(p => p.BookingId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(b => b.Reviews)
            .WithOne(r => r.Booking)
            .HasForeignKey(r => r.BookingId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(b => b.AgentWorkflowRuns)
            .WithOne(w => w.Booking)
            .HasForeignKey(w => w.BookingId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(b => b.VehicleAssignments)
            .WithOne(v => v.Booking)
            .HasForeignKey(v => v.BookingId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(b => b.GuideAvailabilities)
            .WithOne(g => g.AssignedBooking)
            .HasForeignKey(g => g.AssignedBookingId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
