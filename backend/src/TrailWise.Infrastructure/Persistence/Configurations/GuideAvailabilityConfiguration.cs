using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class GuideAvailabilityConfiguration : IEntityTypeConfiguration<GuideAvailability>
{
    public void Configure(EntityTypeBuilder<GuideAvailability> builder)
    {
        builder.HasOne(g => g.Guide)
            .WithMany(guide => guide.Availability)
            .HasForeignKey(g => g.GuideId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(g => new { g.GuideId, g.Date }).IsUnique();
    }
}
