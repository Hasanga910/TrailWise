namespace TrailWise.Domain.Entities;

public class TourPackagePhoto
{
    public Guid TourPackageId { get; set; }
    public TourPackage TourPackage { get; set; } = null!;

    public byte[] Data { get; set; } = Array.Empty<byte>();
    public string ContentType { get; set; } = string.Empty;
    public string? FileName { get; set; }
    public int SizeBytes { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
