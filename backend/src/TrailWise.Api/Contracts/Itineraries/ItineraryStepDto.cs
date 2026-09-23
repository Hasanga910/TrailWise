using TrailWise.Domain.Entities;

namespace TrailWise.Api.Contracts.Itineraries;

public record ItineraryStepDto(
    Guid Id,
    Guid BookingId,
    int DayNumber,
    string Activity,
    string Location,
    TimeOnly StartTime)
{
    public static ItineraryStepDto FromEntity(ItineraryStep step) => new(
        step.Id,
        step.BookingId,
        step.DayNumber,
        step.Activity,
        step.Location,
        step.StartTime);
}
