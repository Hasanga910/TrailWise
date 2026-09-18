using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class PackageLocationConfiguration : IEntityTypeConfiguration<PackageLocation>
{
    public void Configure(EntityTypeBuilder<PackageLocation> builder)
    {
        builder.Property(l => l.Name).IsRequired().HasMaxLength(200);

        builder.HasOne(l => l.TourPackage)
            .WithMany(p => p.Locations)
            .HasForeignKey(l => l.TourPackageId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
