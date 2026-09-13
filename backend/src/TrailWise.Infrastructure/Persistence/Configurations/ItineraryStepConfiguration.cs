using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class ItineraryStepConfiguration : IEntityTypeConfiguration<ItineraryStep>
{
    public void Configure(EntityTypeBuilder<ItineraryStep> builder)
    {
        builder.Property(i => i.Activity).IsRequired().HasMaxLength(300);
        builder.Property(i => i.Location).HasMaxLength(300);
    }
}
