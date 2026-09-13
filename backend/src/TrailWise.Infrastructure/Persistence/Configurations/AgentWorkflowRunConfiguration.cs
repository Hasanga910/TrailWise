using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class AgentWorkflowRunConfiguration : IEntityTypeConfiguration<AgentWorkflowRun>
{
    public void Configure(EntityTypeBuilder<AgentWorkflowRun> builder)
    {
        builder.Property(w => w.Objective).IsRequired().HasMaxLength(500);
        builder.Property(w => w.PlanJson).HasColumnType("jsonb");
        builder.Property(w => w.Status).HasMaxLength(32);

        builder.HasMany(w => w.StepLogs)
            .WithOne(s => s.WorkflowRun)
            .HasForeignKey(s => s.WorkflowRunId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
