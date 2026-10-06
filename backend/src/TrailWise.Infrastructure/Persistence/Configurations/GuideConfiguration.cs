using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class GuideConfiguration : IEntityTypeConfiguration<Guide>
{
    public void Configure(EntityTypeBuilder<Guide> builder)
    {
        builder.Property(g => g.Name).IsRequired().HasMaxLength(200);
        builder.Property(g => g.ContactInfo).HasMaxLength(200);

        builder.HasOne(g => g.User)
            .WithOne()
            .HasForeignKey<Guide>(g => g.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(g => g.UserId)
            .IsUnique();
    }
}
