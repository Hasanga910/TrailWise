using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class PackageTierConfiguration : IEntityTypeConfiguration<PackageTier>
{
    public void Configure(EntityTypeBuilder<PackageTier> builder)
    {
        builder.Property(t => t.ClassType).HasConversion<string>().HasMaxLength(16);
        builder.Property(t => t.BasePricePerPerson).HasPrecision(10, 2);

        builder.HasMany(t => t.Bookings)
            .WithOne(b => b.PackageTier)
            .HasForeignKey(b => b.PackageTierId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
