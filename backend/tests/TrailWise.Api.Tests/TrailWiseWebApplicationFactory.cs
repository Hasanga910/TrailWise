using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Api.Tests;

public class TrailWiseWebApplicationFactory : WebApplicationFactory<Program>
{
    public readonly string DatabaseName = Guid.NewGuid().ToString();

    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Default"] = "Host=localhost;Database=unused;Username=unused;Password=unused",
                ["Jwt:Secret"] = "test-only-secret-key-for-integration-tests-32chars",
                ["Jwt:Issuer"] = "TrailWise",
                ["Jwt:Audience"] = "TrailWiseClients",
                ["Jwt:ExpiryMinutes"] = "60",
                ["AdminSeed:Email"] = "admin@test.local",
                ["AdminSeed:Password"] = "TestAdminPass123!"
            });
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<TrailWiseDbContext>>();
            services.AddDbContext<TrailWiseDbContext>(options =>
                options.UseInMemoryDatabase(DatabaseName));
        });
    }
}
