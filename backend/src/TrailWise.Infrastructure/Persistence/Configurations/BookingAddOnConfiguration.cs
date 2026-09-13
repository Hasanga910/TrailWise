using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class BookingAddOnConfiguration : IEntityTypeConfiguration<BookingAddOn>
{
    public void Configure(EntityTypeBuilder<BookingAddOn> builder)
    {
        builder.Property(a => a.Description).IsRequired().HasMaxLength(300);
        builder.Property(a => a.Cost).HasPrecision(10, 2);
    }
}
