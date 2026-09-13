using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Register(RegisterTravelerRequest request, CancellationToken ct)
    {
        var result = await _authService.RegisterTravelerAsync(request.Name, request.Email, request.Password, ct);
        if (!result.Succeeded)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: result.Error);
        }

        return Ok(new AuthResponse(result.Token!, UserDto.FromEntity(result.User!)));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        var result = await _authService.LoginAsync(request.Email, request.Password, ct);
        if (!result.Succeeded)
        {
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: result.Error);
        }

        return Ok(new AuthResponse(result.Token!, UserDto.FromEntity(result.User!)));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (userId is null || !Guid.TryParse(userId, out var id))
        {
            return Unauthorized();
        }

        var user = await _authService.GetByIdAsync(id, ct);
        if (user is null)
        {
            return NotFound();
        }

        return Ok(UserDto.FromEntity(user));
    }

    [HttpPost("admin/users")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<UserDto>> CreateUser(CreateUserRequest request, CancellationToken ct)
    {
        var result = await _authService.CreateUserAsync(request.Name, request.Email, request.Password, request.Role, ct);
        if (!result.Succeeded)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: result.Error);
        }

        return Ok(UserDto.FromEntity(result.User!));
    }
}
