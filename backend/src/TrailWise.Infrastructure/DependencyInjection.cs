using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Options;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Missing 'ConnectionStrings:Default' configuration.");

        services.AddDbContext<TrailWiseDbContext>(options =>
            options.UseNpgsql(connectionString));

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<AdminSeedOptions>(configuration.GetSection(AdminSeedOptions.SectionName));

        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddScoped<IAuthService, AuthService>();

        services.AddHttpClient(NominatimLocationSearchService.HttpClientName, client =>
        {
            client.BaseAddress = new Uri("https://nominatim.openstreetmap.org/");
            client.DefaultRequestHeaders.UserAgent.ParseAdd("TrailWise/1.0 (https://trailwise.local)");
        });
        services.AddScoped<ILocationSearchService, NominatimLocationSearchService>();

        services.AddScoped<IGuideMatchingAgent, MockGuideMatchingAgent>();
        services.AddScoped<IFleetCapacityAgent, MockFleetCapacityAgent>();
        services.AddScoped<IFleetReservationService, FleetReservationService>();
        services.AddScoped<IPricingValidationAgent, PricingValidationAgent>();
        services.AddScoped<ICoordinatorAgentService, CoordinatorAgentService>();
        services.AddScoped<IPaymentService, PaymentService>();

        return services;
    }
}
