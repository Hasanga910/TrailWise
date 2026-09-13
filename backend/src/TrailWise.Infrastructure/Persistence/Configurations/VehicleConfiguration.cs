using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class VehicleConfiguration : IEntityTypeConfiguration<Vehicle>
{
    public void Configure(EntityTypeBuilder<Vehicle> builder)
    {
        builder.Property(v => v.Type).HasConversion<string>().HasMaxLength(16);
        builder.Property(v => v.MaintenanceStatus).HasConversion<string>().HasMaxLength(32);
        builder.Property(v => v.SeatConfiguration).HasMaxLength(50);
    }
}
