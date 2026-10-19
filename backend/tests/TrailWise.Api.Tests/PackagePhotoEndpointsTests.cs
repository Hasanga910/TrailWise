using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Packages;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Api.Tests;

public class PackagePhotoEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly byte[] JpegBytes = { 0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4, 5 };
    private static readonly byte[] PngBytes = { 0x89, 0x50, 0x4E, 0x47, 9, 8, 7 };

    private readonly TrailWiseWebApplicationFactory _factory;

    public PackagePhotoEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Upload_StoresPhotoRow_AndSetsPhotoUrl()
    {
        var client = await ApiTestHelpers.ClientForRoleAsync(_factory, "OperationsManager");
        var packageId = await CreatePackageAsync(client);

        var response = await client.PostAsync($"/api/packages/{packageId}/photo", PhotoForm(JpegBytes, "image/jpeg", "cover.jpg"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<TourPackageDto>(ApiTestHelpers.JsonOptions);
        Assert.StartsWith($"/api/packages/{packageId}/photo?v=", dto!.PhotoUrl);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var stored = await db.TourPackagePhotos.AsNoTracking().SingleAsync(p => p.TourPackageId == packageId);
        Assert.Equal(JpegBytes, stored.Data);
        Assert.Equal("image/jpeg", stored.ContentType);
        Assert.Equal("cover.jpg", stored.FileName);
        Assert.Equal(JpegBytes.Length, stored.SizeBytes);
    }

    [Fact]
    public async Task GetPhoto_Anonymous_ReturnsBytesAndContentType()
    {
        var client = await ApiTestHelpers.ClientForRoleAsync(_factory, "OperationsManager");
        var packageId = await CreatePackageAsync(client);
        var upload = await client.PostAsync($"/api/packages/{packageId}/photo", PhotoForm(PngBytes, "image/png", "cover.png"));
        upload.EnsureSuccessStatusCode();
        var dto = await upload.Content.ReadFromJsonAsync<TourPackageDto>(ApiTestHelpers.JsonOptions);

        var anonymous = _factory.CreateClient();
        var response = await anonymous.GetAsync(dto!.PhotoUrl);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(PngBytes, await response.Content.ReadAsByteArrayAsync());
        Assert.True(response.Headers.CacheControl?.Public);
        Assert.Equal(TimeSpan.FromDays(1), response.Headers.CacheControl?.MaxAge);
    }

    [Fact]
    public async Task Upload_Twice_ReplacesPhotoAndChangesUrl()
    {
        var client = await ApiTestHelpers.ClientForRoleAsync(_factory, "OperationsManager");
        var packageId = await CreatePackageAsync(client);

        var first = await client.PostAsync($"/api/packages/{packageId}/photo", PhotoForm(JpegBytes, "image/jpeg", "a.jpg"));
        var firstDto = await first.Content.ReadFromJsonAsync<TourPackageDto>(ApiTestHelpers.JsonOptions);
        var second = await client.PostAsync($"/api/packages/{packageId}/photo", PhotoForm(PngBytes, "image/png", "b.png"));
        var secondDto = await second.Content.ReadFromJsonAsync<TourPackageDto>(ApiTestHelpers.JsonOptions);

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.NotEqual(firstDto!.PhotoUrl, secondDto!.PhotoUrl);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var rows = await db.TourPackagePhotos.AsNoTracking().Where(p => p.TourPackageId == packageId).ToListAsync();
        var row = Assert.Single(rows);
        Assert.Equal(PngBytes, row.Data);
        Assert.Equal("image/png", row.ContentType);
    }

    [Fact]
    public async Task Upload_WithUnsupportedContentType_ReturnsBadRequest()
    {
        var client = await ApiTestHelpers.ClientForRoleAsync(_factory, "OperationsManager");
        var packageId = await CreatePackageAsync(client);

        var response = await client.PostAsync($"/api/packages/{packageId}/photo", PhotoForm(new byte[] { 1, 2, 3 }, "image/gif", "anim.gif"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False(await PhotoRowExistsAsync(packageId));
    }

    [Fact]
    public async Task Upload_LargerThanFiveMegabytes_IsRejected()
    {
        var client = await ApiTestHelpers.ClientForRoleAsync(_factory, "OperationsManager");
        var packageId = await CreatePackageAsync(client);
        var tooLarge = new byte[5 * 1024 * 1024 + 1];

        var response = await client.PostAsync($"/api/packages/{packageId}/photo", PhotoForm(tooLarge, "image/jpeg", "big.jpg"));

        Assert.Contains(response.StatusCode, new[] { HttpStatusCode.BadRequest, HttpStatusCode.RequestEntityTooLarge });
        Assert.False(await PhotoRowExistsAsync(packageId));
    }

    [Fact]
    public async Task Upload_WithoutPhoto_ReturnsBadRequest()
    {
        var client = await ApiTestHelpers.ClientForRoleAsync(_factory, "OperationsManager");
        var packageId = await CreatePackageAsync(client);
        using var form = new MultipartFormDataContent { { new StringContent("x"), "other" } };

        var response = await client.PostAsync($"/api/packages/{packageId}/photo", form);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetPhoto_ForPackageWithoutPhoto_ReturnsNotFound()
    {
        var client = await ApiTestHelpers.ClientForRoleAsync(_factory, "OperationsManager");
        var packageId = await CreatePackageAsync(client);
        var anonymous = _factory.CreateClient();

        var response = await anonymous.GetAsync($"/api/packages/{packageId}/photo");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetPhoto_ForUnknownPackage_ReturnsNotFound()
    {
        var response = await _factory.CreateClient().GetAsync($"/api/packages/{Guid.NewGuid()}/photo");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PackageList_DoesNotIncludePhotoBytes()
    {
        var client = await ApiTestHelpers.ClientForRoleAsync(_factory, "OperationsManager");
        var packageId = await CreatePackageAsync(client);
        var upload = await client.PostAsync($"/api/packages/{packageId}/photo", PhotoForm(JpegBytes, "image/jpeg", "cover.jpg"));
        upload.EnsureSuccessStatusCode();

        var response = await _factory.CreateClient().GetAsync("/api/packages");
        response.EnsureSuccessStatusCode();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        var item = json.RootElement.EnumerateArray()
            .Single(p => p.GetProperty("id").GetGuid() == packageId);
        Assert.StartsWith($"/api/packages/{packageId}/photo?v=", item.GetProperty("photoUrl").GetString());

        var propertyNames = item.EnumerateObject().Select(p => p.Name.ToLowerInvariant()).ToList();
        Assert.DoesNotContain("photo", propertyNames);
        Assert.DoesNotContain("data", propertyNames);
        Assert.DoesNotContain(Convert.ToBase64String(JpegBytes), item.GetRawText());
    }

    private async Task<bool> PhotoRowExistsAsync(Guid packageId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        return await db.TourPackagePhotos.AnyAsync(p => p.TourPackageId == packageId);
    }

    private static async Task<Guid> CreatePackageAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/packages", new
        {
            Name = $"Photo Test Package {Guid.NewGuid():N}",
            Theme = "Testing",
            DurationDays = 2,
            BasePricePerPerson = 100m,
            MaxGroupSize = 10,
            Tiers = new[]
            {
                new { ClassType = "Normal", IncludesFood = false, BasePricePerPerson = 100m, RequiresAC = false }
            },
            LocationNames = new[] { "Galle" }
        });
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<TourPackageDto>(ApiTestHelpers.JsonOptions);
        return created!.Id;
    }

    private static MultipartFormDataContent PhotoForm(byte[] bytes, string contentType, string fileName)
    {
        var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(bytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(fileContent, "photo", fileName);
        return form;
    }
}
