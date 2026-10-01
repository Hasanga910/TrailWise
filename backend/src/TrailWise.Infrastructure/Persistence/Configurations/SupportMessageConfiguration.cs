using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class SupportMessageConfiguration : IEntityTypeConfiguration<SupportMessage>
{
    public void Configure(EntityTypeBuilder<SupportMessage> builder)
    {
        builder.Property(m => m.Message).IsRequired().HasMaxLength(4000);

        builder.HasOne(m => m.SupportTicket)
            .WithMany(t => t.Messages)
            .HasForeignKey(m => m.SupportTicketId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.Sender)
            .WithMany()
            .HasForeignKey(m => m.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(m => m.SupportTicketId);
        builder.HasIndex(m => m.CreatedAt);
    }
}
