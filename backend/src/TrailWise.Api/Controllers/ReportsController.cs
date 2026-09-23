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

    public ReportsController(IAuditReportService auditReportService)
    {
        _auditReportService = auditReportService;
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
}
