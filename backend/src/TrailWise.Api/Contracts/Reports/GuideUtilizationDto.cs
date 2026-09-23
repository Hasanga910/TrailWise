namespace TrailWise.Api.Contracts.Reports;

public record GuideUtilizationDto(
    Guid GuideId,
    string GuideName,
    int AssignedDays,
    int AvailableDays,
    int RecordedDays,
    double UtilizationPercentage
);
