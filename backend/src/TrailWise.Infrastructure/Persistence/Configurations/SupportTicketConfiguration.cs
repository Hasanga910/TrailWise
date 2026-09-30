using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class SupportTicketConfiguration : IEntityTypeConfiguration<SupportTicket>
{
    public void Configure(EntityTypeBuilder<SupportTicket> builder)
    {
        builder.Property(t => t.Subject).IsRequired().HasMaxLength(200);
        builder.Property(t => t.Description).IsRequired().HasMaxLength(4000);
        builder.Property(t => t.Category).HasConversion<string>().HasMaxLength(32);
        builder.Property(t => t.Priority).HasConversion<string>().HasMaxLength(32);
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(32);

        builder.HasOne(t => t.Traveler)
            .WithMany()
            .HasForeignKey(t => t.TravelerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(t => t.Booking)
            .WithMany()
            .HasForeignKey(t => t.BookingId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.AssignedTo)
            .WithMany()
            .HasForeignKey(t => t.AssignedToId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(t => t.Messages)
            .WithOne(m => m.SupportTicket)
            .HasForeignKey(m => m.SupportTicketId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(t => t.TravelerId);
        builder.HasIndex(t => t.Status);
        builder.HasIndex(t => t.Category);
        builder.HasIndex(t => t.Priority);
        builder.HasIndex(t => t.AssignedToId);
        builder.HasIndex(t => t.BookingId);
        builder.HasIndex(t => t.CreatedAt);
    }
}
