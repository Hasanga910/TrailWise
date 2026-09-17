using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrailWise.Api.Contracts.Locations;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/locations")]
[Authorize]
public class LocationsController : ControllerBase
{
    private readonly ILocationSearchService _locationSearchService;

    public LocationsController(ILocationSearchService locationSearchService)
    {
        _locationSearchService = locationSearchService;
    }

    [HttpGet("search")]
    public async Task<ActionResult<IReadOnlyList<LocationSuggestionDto>>> Search([FromQuery] string? query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
        {
            return Ok(Array.Empty<LocationSuggestionDto>());
        }

        var suggestions = await _locationSearchService.SearchAsync(query, ct);
        return Ok(suggestions.Select(LocationSuggestionDto.FromSuggestion).ToList());
    }
}
