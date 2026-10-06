namespace TrailWise.Domain.Entities;

public class Discount : BaseEntity
{
    public string Description { get; set; } = string.Empty;
    public decimal PercentageOff { get; set; }
    public int MinGroupSize { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset? ValidFrom { get; set; }
    public DateTimeOffset? ValidUntil { get; set; }
}
