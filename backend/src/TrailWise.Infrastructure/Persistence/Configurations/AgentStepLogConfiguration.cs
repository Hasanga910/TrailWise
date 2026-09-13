using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class AgentStepLogConfiguration : IEntityTypeConfiguration<AgentStepLog>
{
    public void Configure(EntityTypeBuilder<AgentStepLog> builder)
    {
        builder.Property(s => s.AgentName).IsRequired().HasMaxLength(100);
        builder.Property(s => s.InputJson).HasColumnType("jsonb");
        builder.Property(s => s.OutputJson).HasColumnType("jsonb");
        builder.Property(s => s.ToolCallsJson).HasColumnType("jsonb");
    }
}
