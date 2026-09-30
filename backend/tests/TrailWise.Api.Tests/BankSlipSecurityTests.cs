using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Payments;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class BankSlipSecurityTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public BankSlipSecurityTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // 1. Admin can GET payment slip
    [Fact]
    public async Task GetPaymentSlip_Admin_CanAccessPaymentSlip()
    {
        var (paymentId, _) = await CreatePaymentWithSlipAsync("slip.jpg", "image/jpeg", new byte[] { 1, 2, 3, 4 });
        var adminClient = await AuthenticatedAdminAsync();

        var response = await adminClient.GetAsync($"/api/payments/{paymentId}/slip");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/jpeg", response.Content.Headers.ContentType?.MediaType);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.Equal(new byte[] { 1, 2, 3, 4 }, bytes);
    }

    // 2. OperationsManager can GET payment slip
    [Fact]
    public async Task GetPaymentSlip_OperationsManager_CanAccessPaymentSlip()
    {
        var (paymentId, _) = await CreatePaymentWithSlipAsync("slip.jpg", "image/jpeg", new byte[] { 5, 6, 7 });
        var opsClient = await AuthenticatedUserWithRoleAsync("OperationsManager");

        var response = await opsClient.GetAsync($"/api/payments/{paymentId}/slip");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/jpeg", response.Content.Headers.ContentType?.MediaType);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.Equal(new byte[] { 5, 6, 7 }, bytes);
    }

    // 3. Booking owner Traveler can GET own slip
    [Fact]
    public async Task GetPaymentSlip_BookingOwnerTraveler_CanAccessOwnSlip()
    {
        var (paymentId, ownerClient) = await CreatePaymentWithSlipAsync("my-slip.png", "image/png", new byte[] { 10, 20, 30 });

        var response = await ownerClient.GetAsync($"/api/payments/{paymentId}/slip");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.Equal(new byte[] { 10, 20, 30 }, bytes);
    }

    // 4. Different Traveler gets 403
    [Fact]
    public async Task GetPaymentSlip_DifferentTraveler_Returns403Forbidden()
    {
        var (paymentId, _) = await CreatePaymentWithSlipAsync("slip.jpg", "image/jpeg", new byte[] { 1, 2, 3 });
        var otherTraveler = await AuthenticatedTravelerAsync();

        var response = await otherTraveler.GetAsync($"/api/payments/{paymentId}/slip");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // 5. TourGuide gets 403
    [Fact]
    public async Task GetPaymentSlip_TourGuide_Returns403Forbidden()
    {
        var (paymentId, _) = await CreatePaymentWithSlipAsync("slip.jpg", "image/jpeg", new byte[] { 1, 2, 3 });
        var guideClient = await AuthenticatedUserWithRoleAsync("TourGuide");

        var response = await guideClient.GetAsync($"/api/payments/{paymentId}/slip");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // 6. FleetCoordinator gets 403
    [Fact]
    public async Task GetPaymentSlip_FleetCoordinator_Returns403Forbidden()
    {
        var (paymentId, _) = await CreatePaymentWithSlipAsync("slip.jpg", "image/jpeg", new byte[] { 1, 2, 3 });
        var coordinatorClient = await AuthenticatedUserWithRoleAsync("FleetCoordinator");

        var response = await coordinatorClient.GetAsync($"/api/payments/{paymentId}/slip");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // 7. Anonymous gets 401
    [Fact]
    public async Task GetPaymentSlip_Anonymous_Returns401Unauthorized()
    {
        var (paymentId, _) = await CreatePaymentWithSlipAsync("slip.jpg", "image/jpeg", new byte[] { 1, 2, 3 });
        var anonymousClient = _factory.CreateClient();

        var response = await anonymousClient.GetAsync($"/api/payments/{paymentId}/slip");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // 8. Missing payment returns 404
    [Fact]
    public async Task GetPaymentSlip_MissingPayment_Returns404NotFound()
    {
        var adminClient = await AuthenticatedAdminAsync();
        var nonExistentPaymentId = Guid.NewGuid();

        var response = await adminClient.GetAsync($"/api/payments/{nonExistentPaymentId}/slip");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // 9. Missing physical slip returns 404
    [Fact]
    public async Task GetPaymentSlip_MissingPhysicalSlip_Returns404NotFound()
    {
        var (ownerClient, bookingId, _) = await SetupConfirmedBookingAsync(500m);
        var adminClient = await AuthenticatedAdminAsync();

        // Seed a payment with non-existent file on disk
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var payment = new Payment
        {
            BookingId = bookingId,
            Amount = 250m,
            Method = "BankTransfer",
            BankSlipUrl = "slips/missing-file-does-not-exist.jpg",
            SubmittedAt = DateTimeOffset.UtcNow,
            Status = PaymentStatus.Pending
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync();

        var response = await adminClient.GetAsync($"/api/payments/{payment.Id}/slip");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // 10. Correct image MIME type returned
    [Fact]
    public async Task GetPaymentSlip_PngAndWebp_ReturnCorrectMimeTypes()
    {
        var (pngPaymentId, _) = await CreatePaymentWithSlipAsync("receipt.png", "image/png", new byte[] { 0x89, 0x50, 0x4E, 0x47 });
        var (webpPaymentId, _) = await CreatePaymentWithSlipAsync("receipt.webp", "image/webp", new byte[] { 0x52, 0x49, 0x46, 0x46 });
        var adminClient = await AuthenticatedAdminAsync();

        var pngRes = await adminClient.GetAsync($"/api/payments/{pngPaymentId}/slip");
        Assert.Equal(HttpStatusCode.OK, pngRes.StatusCode);
        Assert.Equal("image/png", pngRes.Content.Headers.ContentType?.MediaType);

        var webpRes = await adminClient.GetAsync($"/api/payments/{webpPaymentId}/slip");
        Assert.Equal(HttpStatusCode.OK, webpRes.StatusCode);
        Assert.Equal("image/webp", webpRes.Content.Headers.ContentType?.MediaType);
    }

    // 11. Correct PDF MIME type returned
    [Fact]
    public async Task GetPaymentSlip_PdfFile_ReturnsCorrectPdfMimeType()
    {
        var pdfBytes = new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D }; // %PDF-
        var (pdfPaymentId, _) = await CreatePaymentWithSlipAsync("statement.pdf", "application/pdf", pdfBytes);
        var adminClient = await AuthenticatedAdminAsync();

        var response = await adminClient.GetAsync($"/api/payments/{pdfPaymentId}/slip");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.Equal(pdfBytes, bytes);
    }

    // 12. Physical storage path is never returned
    [Fact]
    public async Task GetPaymentSlip_PhysicalStoragePathIsNeverReturned()
    {
        var (paymentId, _) = await CreatePaymentWithSlipAsync("slip.jpg", "image/jpeg", new byte[] { 1, 2, 3 });
        var adminClient = await AuthenticatedAdminAsync();

        var response = await adminClient.GetAsync($"/api/payments/{paymentId}/slip");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        // Verify no headers leak filesystem paths
        foreach (var header in response.Headers)
        {
            Assert.DoesNotContain("private_uploads", header.Value.FirstOrDefault() ?? string.Empty, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("wwwroot", header.Value.FirstOrDefault() ?? string.Empty, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain(":\\", header.Value.FirstOrDefault() ?? string.Empty);
        }
    }

    // 13. Path traversal is rejected/safely prevented
    [Fact]
    public async Task GetPaymentSlip_PathTraversalIsSafelyPrevented()
    {
        var (ownerClient, bookingId, _) = await SetupConfirmedBookingAsync(500m);
        var adminClient = await AuthenticatedAdminAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var payment = new Payment
        {
            BookingId = bookingId,
            Amount = 250m,
            Method = "BankTransfer",
            BankSlipUrl = "../../etc/passwd",
            SubmittedAt = DateTimeOffset.UtcNow,
            Status = PaymentStatus.Pending
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync();

        var response = await adminClient.GetAsync($"/api/payments/{payment.Id}/slip");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // 14. Old public /uploads/slips URL no longer exposes slip
    [Fact]
    public async Task OldPublicUploadsSlipsUrl_NoLongerExposesSlip()
    {
        var anonymousClient = _factory.CreateClient();

        // Any request to /uploads/slips/* should yield 404
        var response = await anonymousClient.GetAsync("/uploads/slips/any-slip-name.jpg");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // 15. Existing bank-transfer submission still stores files successfully and stores safe reference
    [Fact]
    public async Task SubmitBankTransfer_StoresFileInPrivateStorage_AndStoresSafeRelativeReference()
    {
        var (ownerClient, bookingId, _) = await SetupConfirmedBookingAsync(500m);

        using var form = new MultipartFormDataContent();
        form.Add(new StringContent("250.00"), "amount");
        var fileContent = new ByteArrayContent(new byte[] { 100, 101, 102 });
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        form.Add(fileContent, "bankSlip", "myslip.jpg");

        var response = await ownerClient.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payment = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.NotNull(payment);

        // Safe relative reference stored
        Assert.StartsWith("slips/", payment.BankSlipUrl);
        Assert.DoesNotContain("wwwroot", payment.BankSlipUrl);
        Assert.DoesNotContain("..", payment.BankSlipUrl);
        Assert.EndsWith(".jpg", payment.BankSlipUrl);

        // Verify the file can now be retrieved via authenticated endpoint
        var slipRes = await ownerClient.GetAsync($"/api/payments/{payment.Id}/slip");
        Assert.Equal(HttpStatusCode.OK, slipRes.StatusCode);
        var fetchedBytes = await slipRes.Content.ReadAsByteArrayAsync();
        Assert.Equal(new byte[] { 100, 101, 102 }, fetchedBytes);
    }

    // 16. Legacy slip reference can be resolved through authenticated endpoint
    [Fact]
    public async Task LegacySlipReference_CanBeResolvedAndDeliveredThroughAuthenticatedEndpoint()
    {
        var (ownerClient, bookingId, _) = await SetupConfirmedBookingAsync(500m);
        var adminClient = await AuthenticatedAdminAsync();

        // Save a test file directly in private_uploads/slips or via storage service
        using var scope = _factory.Services.CreateScope();
        var storage = scope.ServiceProvider.GetRequiredService<IBankSlipStorageService>();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        using var stream = new MemoryStream(new byte[] { 200, 201, 202 });
        var storageRef = await storage.SaveSlipAsync(stream, "legacy.jpg", "image/jpeg");

        var fileName = Path.GetFileName(storageRef);
        // Simulate a legacy DB record that stored "/uploads/slips/{filename}"
        var payment = new Payment
        {
            BookingId = bookingId,
            Amount = 250m,
            Method = "BankTransfer",
            BankSlipUrl = $"/uploads/slips/{fileName}",
            SubmittedAt = DateTimeOffset.UtcNow,
            Status = PaymentStatus.Pending
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync();

        var response = await adminClient.GetAsync($"/api/payments/{payment.Id}/slip");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.Equal(new byte[] { 200, 201, 202 }, bytes);
    }

    private async Task<(Guid PaymentId, HttpClient OwnerClient)> CreatePaymentWithSlipAsync(
        string fileName,
        string contentType,
        byte[] bytes)
    {
        var (client, bookingId, _) = await SetupConfirmedBookingAsync(500m);

        using var form = new MultipartFormDataContent();
        form.Add(new StringContent("250.00"), "amount");
        var fileContent = new ByteArrayContent(bytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(fileContent, "bankSlip", fileName);

        var response = await client.PostAsync($"/api/bookings/{bookingId}/payments/bank-transfer", form);
        response.EnsureSuccessStatusCode();

        var payment = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        return (payment!.Id, client);
    }

    private async Task<(HttpClient Client, Guid BookingId, Guid TravelerId)> SetupConfirmedBookingAsync(decimal totalCost)
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var package = new TourPackage
        {
            Name = "Slip Test Tour",
            Theme = "Test",
            DurationDays = 3,
            BasePricePerPerson = 250m,
            MaxGroupSize = 10
        };
        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = false,
            BasePricePerPerson = 250m,
            RequiresAC = false
        };
        var booking = new Booking
        {
            TravelerId = travelerId,
            TourPackage = package,
            PackageTier = tier,
            Status = BookingStatus.Confirmed,
            GroupSize = 2,
            BudgetPerPerson = 500m,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10))
        };

        db.TourPackages.Add(package);
        db.PackageTiers.Add(tier);
        db.Bookings.Add(booking);

        var run = new AgentWorkflowRun
        {
            Booking = booking,
            Objective = "Pricing Test",
            Status = "Completed",
            StartedAt = DateTimeOffset.UtcNow,
            CompletedAt = DateTimeOffset.UtcNow
        };
        db.AgentWorkflowRuns.Add(run);

        var stepLog = new AgentStepLog
        {
            WorkflowRun = run,
            AgentName = "PricingValidationAgent",
            InputJson = JsonSerializer.Serialize(new { bookingId = booking.Id }),
            OutputJson = JsonSerializer.Serialize(new
            {
                totalCost,
                breakdown = "{}",
                validationResult = "Valid"
            }),
            DurationMs = 10
        };
        db.AgentStepLogs.Add(stepLog);

        await db.SaveChangesAsync();

        return (client, booking.Id, travelerId);
    }

    private async Task<(HttpClient Client, Guid TravelerId)> AuthenticatedTravelerWithIdAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "Traveler T", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.User.Id);
    }

    private async Task<HttpClient> AuthenticatedTravelerAsync()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        return client;
    }

    private async Task<HttpClient> AuthenticatedAdminAsync()
    {
        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private async Task<HttpClient> AuthenticatedUserWithRoleAsync(string role)
    {
        var client = _factory.CreateClient();
        var adminClient = await AuthenticatedAdminAsync();

        var email = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@example.com";
        var createResponse = await adminClient.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = $"Test {role}",
            Email = email,
            Password = "P@ssword123",
            ContactNumber = "+14155550101",
            Role = role
        });
        createResponse.EnsureSuccessStatusCode();

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }
}
