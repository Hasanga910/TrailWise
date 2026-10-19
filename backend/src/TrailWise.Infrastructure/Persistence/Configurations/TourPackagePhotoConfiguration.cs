using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class TourPackagePhotoConfiguration : IEntityTypeConfiguration<TourPackagePhoto>
{
    public void Configure(EntityTypeBuilder<TourPackagePhoto> builder)
    {
        builder.ToTable("TourPackagePhotos");
        builder.HasKey(p => p.TourPackageId);

        builder.Property(p => p.Data).IsRequired();
        builder.Property(p => p.ContentType).IsRequired().HasMaxLength(100);
        builder.Property(p => p.FileName).HasMaxLength(200);

        builder.HasOne(p => p.TourPackage)
            .WithOne(t => t.Photo)
            .HasForeignKey<TourPackagePhoto>(p => p.TourPackageId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
