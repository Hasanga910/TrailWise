using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class TourPackageConfiguration : IEntityTypeConfiguration<TourPackage>
{
    public void Configure(EntityTypeBuilder<TourPackage> builder)
    {
        builder.Property(p => p.Name).IsRequired().HasMaxLength(200);
        builder.Property(p => p.Theme).IsRequired().HasMaxLength(100);
        builder.Property(p => p.BasePricePerPerson).HasPrecision(10, 2);
        builder.Property(p => p.PhotoUrl).HasMaxLength(500);

        builder.HasMany(p => p.PackageTiers)
            .WithOne(t => t.TourPackage)
            .HasForeignKey(t => t.TourPackageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(p => p.Bookings)
            .WithOne(b => b.TourPackage)
            .HasForeignKey(b => b.TourPackageId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
