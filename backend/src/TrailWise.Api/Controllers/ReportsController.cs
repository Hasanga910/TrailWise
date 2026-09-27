using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrailWise.Api.Contracts.Common;
using TrailWise.Api.Contracts.Reports;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(Roles = "OperationsManager,Admin")]
public class ReportsController : ControllerBase
{
    private const int MaxPageSize = 100;
    private readonly IAuditReportService _auditReportService;
    private readonly IOperationsReportService _operationsReportService;

    public ReportsController(
        IAuditReportService auditReportService,
        IOperationsReportService operationsReportService)
    {
        _auditReportService = auditReportService;
        _operationsReportService = operationsReportService;
    }

    [HttpGet("audit")]
    public async Task<ActionResult<AuditReportResponse>> GetAuditLogs(
        [FromQuery] GetAuditLogsQuery query,
        CancellationToken ct)
    {
        var errors = new List<FieldValidationError>();

        if (query.Page < 1)
        {
            errors.Add(new FieldValidationError("page", "Page must be greater than or equal to 1."));
        }

        if (query.PageSize < 1 || query.PageSize > MaxPageSize)
        {
            errors.Add(new FieldValidationError("pageSize", $"PageSize must be between 1 and {MaxPageSize}."));
        }

        if (query.From.HasValue && query.To.HasValue && query.From.Value > query.To.Value)
        {
            errors.Add(new FieldValidationError("to", "'to' date must be on or after 'from' date."));
        }

        if (errors.Count > 0)
        {
            return BadRequest(new { errors });
        }

        var result = await _auditReportService.GetAuditLogsAsync(
            query.EntityType,
            query.From,
            query.To,
            query.Page,
            query.PageSize,
            ct);

        var items = result.Items
            .Select(AuditLogDto.FromEntity)
            .ToList();

        return Ok(new AuditReportResponse(
            items,
            result.Page,
            result.PageSize,
            result.TotalCount,
            result.TotalPages));
    }

    [HttpGet("audit/export")]
    public async Task<IActionResult> ExportAuditLogs(
        [FromQuery] ExportAuditLogsQuery query,
        CancellationToken ct)
    {
        if (query.From.HasValue && query.To.HasValue && query.From.Value > query.To.Value)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("to", "'to' date must be on or after 'from' date.") }
            });
        }

        var csvBytes = await _auditReportService.ExportAuditLogsCsvAsync(
            query.EntityType,
            query.From,
            query.To,
            ct);

        var fileName = $"trailwise-audit-report-{DateTimeOffset.UtcNow:yyyyMMdd}.csv";
        return File(csvBytes, "text/csv", fileName);
    }

    [HttpGet("occupancy")]
    public async Task<ActionResult<IReadOnlyList<PackageOccupancyDto>>> GetOccupancyReport(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken ct)
    {
        var errors = new List<FieldValidationError>();

        if (!from.HasValue)
        {
            errors.Add(new FieldValidationError("from", "'from' date is required."));
        }

        if (!to.HasValue)
        {
            errors.Add(new FieldValidationError("to", "'to' date is required."));
        }

        if (from.HasValue && to.HasValue && from.Value > to.Value)
        {
            errors.Add(new FieldValidationError("to", "'to' date must be on or after 'from' date."));
        }

        if (errors.Count > 0)
        {
            return BadRequest(new { errors });
        }

        var results = await _operationsReportService.GetOccupancyReportAsync(from!.Value, to!.Value, ct);

        var dtos = results.Select(r => new PackageOccupancyDto(
            r.TourPackageId,
            r.PackageName,
            r.MaxGroupSize,
            r.BookingCount,
            r.BookedTravelers,
            r.AverageGroupSize,
            r.OccupancyPercentage
        )).ToList();

        return Ok(dtos);
    }

    [HttpGet("revenue")]
    public async Task<ActionResult<RevenueReportResponse>> GetRevenueReport(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken ct)
    {
        if (from.HasValue && to.HasValue && from.Value > to.Value)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("to", "'to' date must be on or after 'from' date.") }
            });
        }

        var result = await _operationsReportService.GetRevenueReportAsync(from, to, ct);

        var response = new RevenueReportResponse(
            result.TotalRevenue,
            result.ByPackage.Select(p => new PackageRevenueDto(p.TourPackageId, p.PackageName, p.Revenue)).ToList(),
            result.ByMonth.Select(m => new MonthlyRevenueDto(m.Year, m.Month, m.Label, m.Revenue)).ToList()
        );

        return Ok(response);
    }

    [HttpGet("guide-utilization")]
    public async Task<ActionResult<IReadOnlyList<GuideUtilizationDto>>> GetGuideUtilizationReport(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken ct)
    {
        if (from.HasValue && to.HasValue && from.Value > to.Value)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("to", "'to' date must be on or after 'from' date.") }
            });
        }

        var results = await _operationsReportService.GetGuideUtilizationReportAsync(from, to, ct);

        var dtos = results.Select(g => new GuideUtilizationDto(
            g.GuideId,
            g.GuideName,
            g.AssignedDays,
            g.AvailableDays,
            g.RecordedDays,
            g.UtilizationPercentage
        )).ToList();

        return Ok(dtos);
    }
}
