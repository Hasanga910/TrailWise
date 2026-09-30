using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Persistence.Configurations;

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.Property(p => p.Amount).HasPrecision(10, 2);
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(32);
        builder.Property(p => p.Method).HasMaxLength(50);
        builder.Property(p => p.BankSlipUrl).IsRequired().HasMaxLength(500);
        builder.Property(p => p.SubmittedAt).IsRequired();
        builder.Property(p => p.ReviewedAt);
        builder.Property(p => p.ReviewedBy);
        builder.Property(p => p.RejectionReason).HasMaxLength(500);
    }
}
