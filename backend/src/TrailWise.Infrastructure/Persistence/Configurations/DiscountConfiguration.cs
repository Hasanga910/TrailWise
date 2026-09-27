using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class DiscountConfiguration : IEntityTypeConfiguration<Discount>
{
    public void Configure(EntityTypeBuilder<Discount> builder)
    {
        builder.Property(d => d.Description)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(d => d.PercentageOff)
            .HasPrecision(5, 2);

        builder.Property(d => d.MinGroupSize)
            .IsRequired();
    }
}
