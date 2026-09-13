using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class AuthServiceTests
{
    private static AuthService CreateSut(out TrailWise.Infrastructure.Persistence.TrailWiseDbContext db)
    {
        db = TestDbContextFactory.Create();
        return new AuthService(db, new StubTokenService());
    }

    [Fact]
    public async Task RegisterTraveler_Then_Login_Succeeds()
    {
        var sut = CreateSut(out _);

        var registerResult = await sut.RegisterTravelerAsync("Ada Traveler", "ada@example.com", "P@ssword123");
        Assert.True(registerResult.Succeeded);
        Assert.Equal(UserRole.Traveler, registerResult.User!.Role);

        var loginResult = await sut.LoginAsync("ada@example.com", "P@ssword123");
        Assert.True(loginResult.Succeeded);
        Assert.Equal(registerResult.User.Id, loginResult.User!.Id);
        Assert.NotNull(loginResult.Token);
    }

    [Fact]
    public async Task Login_WithWrongPassword_Fails()
    {
        var sut = CreateSut(out _);
        await sut.RegisterTravelerAsync("Ada Traveler", "ada2@example.com", "P@ssword123");

        var result = await sut.LoginAsync("ada2@example.com", "wrong-password");

        Assert.False(result.Succeeded);
        Assert.Equal("Invalid email or password.", result.Error);
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_Fails()
    {
        var sut = CreateSut(out _);
        await sut.RegisterTravelerAsync("Ada Traveler", "dup@example.com", "P@ssword123");

        var second = await sut.RegisterTravelerAsync("Someone Else", "DUP@example.com", "AnotherPass1");

        Assert.False(second.Succeeded);
        Assert.Equal("A user with this email already exists.", second.Error);
    }

    [Fact]
    public async Task CreateUser_CanAssignNonTravelerRole()
    {
        var sut = CreateSut(out _);

        var result = await sut.CreateUserAsync("Guide One", "guide@example.com", "P@ssword123", UserRole.TourGuide);

        Assert.True(result.Succeeded);
        Assert.Equal(UserRole.TourGuide, result.User!.Role);
    }
}
