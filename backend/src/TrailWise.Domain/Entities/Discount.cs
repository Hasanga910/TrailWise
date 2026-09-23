namespace TrailWise.Domain.Entities;

public class Discount : BaseEntity
{
    public string Description { get; set; } = string.Empty;
    public decimal PercentageOff { get; set; }
    public int MinGroupSize { get; set; }
}
