using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class VehicleAssignmentConfiguration : IEntityTypeConfiguration<VehicleAssignment>
{
    public void Configure(EntityTypeBuilder<VehicleAssignment> builder)
    {
        builder.HasOne(v => v.Vehicle)
            .WithMany(veh => veh.Assignments)
            .HasForeignKey(v => v.VehicleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(v => v.Driver)
            .WithMany(d => d.Assignments)
            .HasForeignKey(v => v.DriverId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(v => new { v.VehicleId, v.StartDate });
    }
}
