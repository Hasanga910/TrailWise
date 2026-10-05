using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class ApprovalRequestConfiguration : IEntityTypeConfiguration<ApprovalRequest>
{
    public void Configure(EntityTypeBuilder<ApprovalRequest> builder)
    {
        builder.Property(a => a.Type).HasConversion<string>().HasMaxLength(48);
        builder.Property(a => a.Status).HasConversion<string>().HasMaxLength(32);
        builder.Property(a => a.PreviousBookingStatus).HasConversion<string>().HasMaxLength(32);
        builder.Property(a => a.ReasonsJson).HasColumnType("jsonb");
        builder.Property(a => a.DecisionNote).HasMaxLength(500);
        builder.Property(a => a.RequesterNote).HasMaxLength(500);

        builder.HasOne(a => a.Booking)
            .WithMany()
            .HasForeignKey(a => a.BookingId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(a => new { a.Status, a.Type });

        // At most one open request per booking.
        builder.HasIndex(a => a.BookingId)
            .IsUnique()
            .HasFilter("\"Status\" = 'Pending'");
    }
}
