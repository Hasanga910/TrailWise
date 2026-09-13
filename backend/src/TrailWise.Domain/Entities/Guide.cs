namespace TrailWise.Domain.Entities;

public class Guide : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string[] Languages { get; set; } = Array.Empty<string>();
    public string[] Specializations { get; set; } = Array.Empty<string>();
    public string ContactInfo { get; set; } = string.Empty;

    public ICollection<GuideAvailability> Availability { get; set; } = new List<GuideAvailability>();
}
